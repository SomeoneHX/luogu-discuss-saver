/**
 * HTTP API（Pages Functions，路径前缀 /api）。
 *
 * 架构：Pages 负责**读**（直连 D1）与**派发写任务**（发到 Queue，由后台 Worker 消费）。
 * 抓取动作本身不在 Pages 内执行——见 worker/ 目录。
 */

import { eq, max } from "drizzle-orm";

import type { Hono } from "hono";

import { listDiscuss } from "../crawler/discuss.js";
import { getDb } from "../db/client.js";
import { schema } from "../db/client.js";
import type { Env } from "../env.js";
import { enqueue, type Job } from "../queue/jobs.js";
import { getFeedPage } from "../query/feed.js";
import {
  getPostEntries,
  getPostRepliesWithLatestSnapshot,
  getPostSnapshotByCapturedAt,
  getPostSnapshotsTimeline,
  getPostWithSnapshot,
  getReplyWithLatestSnapshot,
} from "../query/discussion.js";
import {
  getActiveDiscussions,
  getActiveUsers,
  getHotDiscussions,
} from "../query/trending.js";
import {
  getUserProfileBundle,
  getUserTimelinePage,
  parseUserTimelineCursor,
} from "../query/userProfile.js";

function toEpochSeconds(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * 读 API 边缘缓存：用 Cache API 按完整 URL 命中，省 D1 读取额度。
 * 只缓存 GET；TTL 内重复访问不落 D1。
 */
async function withEdgeCache(
  c: { req: { url: string; method: string }; executionCtx: { waitUntil(p: Promise<unknown>): void } },
  ttlSeconds: number,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (c.req.method !== "GET") return handler();
  const cache = caches.default;
  const cached = await cache.match(c.req.url);
  if (cached) return cached;
  const res = await handler();
  const cachedRes = new Response(res.body, res);
  cachedRes.headers.set("Cache-Control", `public, max-age=${String(ttlSeconds)}`);
  c.executionCtx.waitUntil(cache.put(c.req.url, cachedRes.clone()));
  return cachedRes;
}

export function registerApi(app: Hono<{ Bindings: Env }>): void {
  // --- 健康检查：验证 Pages 侧到洛谷的取数通路 + cookie ---
  app.get("/api/health/luogu", async (c) => {
    try {
      const posts = await listDiscuss(c.env, null, 1);
      return c.json({ ok: true, count: posts.length });
    } catch (error) {
      return c.json({ ok: false, error: (error as Error).message }, 502);
    }
  });

  // --- 批量取帖子条目（?ids=1,2,3）---
  app.get("/api/discussions", async (c) => {
    const ids = (c.req.query("ids") ?? "")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n));
    if (!ids.length) return c.json([]);
    return c.json(await getPostEntries(getDb(c.env), ids));
  });

  // --- 帖子详情 + 最新（或指定 capturedAt）快照 ---
  app.get("/api/discussions/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
    try {
      return c.json(await getPostWithSnapshot(getDb(c.env), id));
    } catch {
      return c.json({ error: "Post not found" }, 404);
    }
  });

  // --- 回复列表 + 每条最新快照 ---
  app.get("/api/discussions/:id/replies", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);

    const take = Number(c.req.query("take") ?? 10);
    const skip = Number(c.req.query("skip") ?? 0);
    const orderBy =
      c.req.query("order") === "newest" || c.req.query("orderBy") === "time_desc"
        ? "time_desc"
        : "time_asc";
    const takeAfterReply = toEpochSeconds(c.req.query("takeAfterReply"));

    try {
      return c.json(
        await getPostRepliesWithLatestSnapshot(getDb(c.env), id, {
        orderBy,
        take,
        skip,
          ...(takeAfterReply !== undefined ? { takeAfterReply } : {}),
        }),
      );
    } catch (error) {
      return c.json({ error: (error as Error).message }, 500);
    }
  });

  // --- 快照变更时间线 ---
  app.get("/api/discussions/:id/timeline", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);

    const take = Number(c.req.query("take") ?? 10);
    const cursor = toEpochSeconds(c.req.query("cursor"));
    return c.json(
      await getPostSnapshotsTimeline(getDb(c.env), id, {
        take,
        ...(cursor !== undefined
          ? { cursorCapturedAt: new Date(cursor * 1000) }
          : {}),
      }),
    );
  });

  // --- 指定时间的快照 ---
  app.get("/api/discussions/:id/snapshot", async (c) => {
    const id = Number(c.req.param("id"));
    const capturedAt = toEpochSeconds(c.req.query("capturedAt"));
    if (!Number.isInteger(id) || capturedAt === undefined) {
      return c.json({ error: "id and capturedAt required" }, 400);
    }
    const result = await getPostSnapshotByCapturedAt(
      getDb(c.env),
      id,
      new Date(capturedAt * 1000),
    );
    if (!result) return c.json({ error: "Snapshot not found" }, 404);
    return c.json(result);
  });

  // --- 单条回复 + 最新快照 ---
  app.get("/api/replies/:id", async (c) => {
    const replyId = Number(c.req.param("id"));
    if (!Number.isInteger(replyId)) return c.json({ error: "invalid id" }, 400);
    const reply = await getReplyWithLatestSnapshot(getDb(c.env), replyId);
    if (!reply) return c.json({ error: "Reply not found" }, 404);
    return c.json(reply);
  });

  // --- 推荐列表：「最近」（近 7 天热度）---
  app.get("/api/trending/recent", async (c) =>
    withEdgeCache(c, 60, async () => {
      const limit = Number(c.req.query("limit") ?? 30);
      return c.json({ items: await getHotDiscussions(getDb(c.env), limit) });
    }),
  );

  // --- 推荐列表：「探索」（近 15 天活跃 + 龙王榜侧栏）---
  app.get("/api/trending/explore", async (c) =>
    withEdgeCache(c, 60, async () => {
      const limit = Number(c.req.query("limit") ?? 30);
      const userLimit = Number(c.req.query("userLimit") ?? 140);
      const db = getDb(c.env);
      const [items, users] = await Promise.all([
        getActiveDiscussions(db, limit),
        getActiveUsers(db, userLimit),
      ]);
      return c.json({ items, users });
    }),
  );

  // --- 首页「社区精选」信息流（打分/游标与原版 feed.ts 一致）---
  app.get("/api/feed", async (c) =>
    withEdgeCache(c, 60, async () => {
      const limit = Number(c.req.query("limit") ?? 30);
      const cursor = c.req.query("cursor") ?? null;
      return c.json(await getFeedPage(getDb(c.env), { limit, cursor }));
    }),
  );

  // --- 用户页：资料 + 时间线首页 ---
  app.get("/api/users/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
    const bundle = await getUserProfileBundle(getDb(c.env), id);
    if (!bundle) return c.json({ error: "User not found" }, 404);
    return c.json(bundle);
  });

  // --- 用户页：时间线翻页 ---
  app.get("/api/users/:id/timeline", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
    const cursorRaw = c.req.query("cursor");
    const cursor = cursorRaw ? parseUserTimelineCursor(cursorRaw) : null;
    if (cursorRaw && !cursor) return c.json({ error: "invalid cursor" }, 400);
    const limit = Number(c.req.query("limit") ?? 30);
    const page = await getUserTimelinePage(getDb(c.env), id, {
      limit,
      cursor,
    });
    if (!page) return c.json({ error: "User not found" }, 404);
    return c.json(page);
  });

  // --- 派发「抓取某帖」任务（异步，由后台 Worker 消费）---
  app.post("/api/discussions/:id/crawl", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);

    // 按帖冷却：距最近一次快照确认不足 CRAWL_COOLDOWN_SECONDS 时拒绝，
    // 防止同一帖被反复触发整条回填链（消耗队列 ops 与 D1 写行数）。
    const cooldown = Number(c.env.CRAWL_COOLDOWN_SECONDS ?? "300");
    if (cooldown > 0) {
      const db = getDb(c.env);
      const [row] = await db
        .select({ lastSeen: max(schema.PostSnapshot.lastSeenAt) })
        .from(schema.PostSnapshot)
        .where(eq(schema.PostSnapshot.postId, id));
      if (row?.lastSeen) {
        const elapsed = Date.now() - row.lastSeen.getTime();
        if (elapsed < cooldown * 1000) {
          const retryAfter = Math.ceil((cooldown * 1000 - elapsed) / 1000);
          return c.json(
            { error: `该帖 ${Math.ceil(retryAfter / 60)} 分钟内已更新过，请稍后再试`, retryAfter },
            429,
          );
        }
      }
    }

    const job: Job = { type: "discuss", id };
    let queued = false;
    try {
      queued = await enqueue(c.env, job);
    } catch {
      // 队列配额耗尽 / 不可用 → 直接在 Function 内抓取（waitUntil 异步执行）
    }
    if (!queued) {
      // 队列配额耗尽 / 不可用 → 直接在 Function 内抓取（waitUntil 异步执行）
      const { fetchDiscuss } = await import("../crawler/discuss.js");
      c.executionCtx.waitUntil(
        fetchDiscuss(c.env, job.id, job.page).catch((err: unknown) => {
          console.error(`[crawl] direct crawl failed: ${String(err)}`);
        }),
      );
      return c.json({ queued: false, direct: true, id }, 202);
    }
    return c.json({ queued: true, id }, 202);
  });
}
