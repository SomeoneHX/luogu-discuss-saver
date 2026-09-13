/**
 * 推荐列表查询层（D1 版）。
 * 对应原项目 packages/query/src/trending.ts —— 仅保留讨论（Post/Reply）部分，
 * 文章 / 剪贴板 / 判题分支按需求剔除；exp/age 等 PG/数学函数改在 JS 侧计算。
 */

import { desc, eq, gt, gte, inArray } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import { getPostEntries, type PostDto } from "./discussion.js";

const DEFAULT_LIMIT = 30;

/** Hacker News 风格热度：replyCount^0.8 / (age_hours + 2)^1.8 */
function hotRank(replyCount: number, time: Date, now: number): number {
  const ageHours = Math.max(0, (now - time.getTime()) / 3600_000);
  return (
    Math.pow(Math.max(0, replyCount), 0.8) /
    Math.pow(ageHours + 2, 1.8)
  );
}

/** 活跃度：Σ 1/(1+exp(age_days - 3))，age 按天计（原版语义） */
function activityScore(time: Date, now: number, days = 3): number {
  const ageDays = (now - time.getTime()) / 86_400_000;
  return 1 / (1 + Math.exp(ageDays - days));
}

export interface TrendingCard {
  rank: number;
  score: number;
  post: PostDto;
}

export interface ActiveUserCard {
  id: number;
  name: string;
  color: string;
  badge: string | null;
  ccfLevel: number;
  xcpcLevel: number;
  avatar: string;
  score: number;
}

/** 「最近」页：近 7 天内发帖，按回复数热度排序。 */
export async function getHotDiscussions(
  db: Db,
  limit = DEFAULT_LIMIT,
): Promise<TrendingCard[]> {
  const now = Date.now();
  const since = new Date(now - 7 * 86_400_000);

  const posts = await db
    .select({ id: schema.Post.id, replyCount: schema.Post.replyCount, time: schema.Post.time })
    .from(schema.Post)
    .where(gt(schema.Post.time, since))
    .orderBy(desc(schema.Post.time))
    .limit(200);

  if (!posts.length) return [];

  const ranked = posts
    .map((p) => ({ ...p, rank: hotRank(p.replyCount, p.time, now) }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit);

  const entries = await getPostEntries(db, ranked.map((p) => p.id));
  const byId = new Map(entries.map((e) => [e.id, e]));

  return ranked.flatMap((p) => {
    const post = byId.get(p.id);
    return post ? [{ rank: p.rank, score: p.rank, post }] : [];
  });
}

/** 「探索」页主列表：近 15 天有回复的帖子，按回复时间活跃度排序。 */
export async function getActiveDiscussions(
  db: Db,
  limit = DEFAULT_LIMIT,
): Promise<TrendingCard[]> {
  const now = Date.now();
  const since = new Date(now - 15 * 86_400_000);

  const rows = await db
    .select({ postId: schema.Reply.postId, time: schema.Reply.time })
    .from(schema.Reply)
    .where(gte(schema.Reply.time, since));

  const scores = new Map<number, number>();
  for (const row of rows) {
    scores.set(row.postId, (scores.get(row.postId) ?? 0) + activityScore(row.time, now));
  }

  const top = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  if (!top.length) return [];

  const entries = await getPostEntries(db, top.map(([id]) => id));
  const byId = new Map(entries.map((e) => [e.id, e]));

  return top.flatMap(([id, score]) => {
    const post = byId.get(id);
    return post ? [{ rank: score, score, post }] : [];
  });
}

/** 「探索」页侧栏：近 20 天活跃用户（发帖作者 + 回复者）。 */
export async function getActiveUsers(
  db: Db,
  limit = DEFAULT_LIMIT,
): Promise<ActiveUserCard[]> {
  const now = Date.now();
  const since = new Date(now - 20 * 86_400_000);

  const [postAuthors, replyAuthors] = await Promise.all([
    db
      .select({ authorId: schema.PostSnapshot.authorId, time: schema.Post.time })
      .from(schema.Post)
      .innerJoin(
        schema.PostSnapshot,
        eq(schema.PostSnapshot.postId, schema.Post.id),
      )
      .where(gt(schema.Post.time, since)),
    db
      .select({ authorId: schema.Reply.authorId, time: schema.Reply.time })
      .from(schema.Reply)
      .where(gt(schema.Reply.time, since)),
  ]);

  const scores = new Map<number, number>();
  for (const row of [...postAuthors, ...replyAuthors]) {
    scores.set(
      row.authorId,
      (scores.get(row.authorId) ?? 0) + activityScore(row.time, now, 7),
    );
  }

  const top = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  if (!top.length) return [];

  // 每个用户取最新一条 UserSnapshot 作为展示资料（D1 单查询最多 100 个绑定参数，需分批）
  const topIds = top.map(([id]) => id);
  const snapshotRows: {
    userId: number;
    name: string;
    color: string;
    badge: string | null;
    ccfLevel: number;
    xcpcLevel: number;
    capturedAt: Date;
  }[] = [];
  for (let i = 0; i < topIds.length; i += 90) {
    const batch = topIds.slice(i, i + 90);
    if (batch.length === 0) continue;
    const rows = await db
      .select({
        userId: schema.UserSnapshot.userId,
        name: schema.UserSnapshot.name,
        color: schema.UserSnapshot.color,
        badge: schema.UserSnapshot.badge,
        ccfLevel: schema.UserSnapshot.ccfLevel,
        xcpcLevel: schema.UserSnapshot.xcpcLevel,
        capturedAt: schema.UserSnapshot.capturedAt,
      })
      .from(schema.UserSnapshot)
      .where(inArray(schema.UserSnapshot.userId, batch))
      .orderBy(desc(schema.UserSnapshot.capturedAt));
    snapshotRows.push(...rows);
  }

  const latest = new Map<number, (typeof snapshotRows)[number]>();
  for (const row of snapshotRows) {
    if (!latest.has(row.userId)) latest.set(row.userId, row);
  }

  return top.flatMap(([id, score]) => {
    const snap = latest.get(id);
    if (!snap) return [];
    return [
      {
        id,
        name: snap.name,
        color: snap.color,
        badge: snap.badge,
        ccfLevel: snap.ccfLevel,
        xcpcLevel: snap.xcpcLevel,
        avatar: `https://cdn.luogu.com.cn/upload/usericon/${String(id)}.png`,
        score,
      },
    ];
  });
}
