/**
 * 快照持久化（Pages 版）。
 *
 * 替代原项目的 `pg_advisory_xact_lock` 事务逻辑，同时替代 Workers 版里的
 * Durable Object 串行化：改用 **contentHash 幂等** ——
 *   读该实体的最新快照 → hash 相同则只更新 lastSeenAt；不同则插入新版本。
 *
 * 说明：Pages Functions 下每条 API 请求独立执行，按需抓取场景对同一帖的并发
 * 极低；`onConflictDoNothing` 兜住极端并发导致的同秒主键冲突。若未来需要严格
 * 串行（例如恢复全量自动抓取），可再引入 Durable Object。
 */

import { and, desc, eq } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface PostSnapshotInput {
  id: number;
  /** 服务器时间（Unix 秒），作为快照 capturedAt */
  time: number;
  replyCount: number;
  title: string;
  authorId: number;
  forumSlug: string;
  topped: boolean;
  locked: boolean;
  content: string;
  pinnedReplyId: number | null;
}

export interface ReplySnapshotInput {
  id: number;
  postId: number;
  authorId: number;
  /** 服务器时间（Unix 秒），作为快照 capturedAt */
  time: number;
  content: string;
}

function postHash(p: PostSnapshotInput): Promise<string> {
  return sha256Hex(
    JSON.stringify([
      p.title,
      p.authorId,
      p.forumSlug,
      p.topped,
      p.locked,
      p.content,
      p.pinnedReplyId,
    ]),
  );
}

/** 保存帖子快照：内容有变则插入新版本，否则只刷新 lastSeenAt。 */
export async function savePostSnapshot(
  db: Db,
  payload: PostSnapshotInput,
): Promise<{ isNew: boolean }> {
  const now = new Date(payload.time * 1000);
  const hash = await postHash(payload);

  const [latest] = await db
    .select({
      capturedAt: schema.PostSnapshot.capturedAt,
      contentHash: schema.PostSnapshot.contentHash,
    })
    .from(schema.PostSnapshot)
    .where(eq(schema.PostSnapshot.postId, payload.id))
    .orderBy(desc(schema.PostSnapshot.capturedAt))
    .limit(1);

  if (latest && latest.contentHash === hash) {
    await db
      .update(schema.PostSnapshot)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(schema.PostSnapshot.postId, payload.id),
          eq(schema.PostSnapshot.capturedAt, latest.capturedAt),
        ),
      );
    return { isNew: false };
  }

  await db
    .insert(schema.PostSnapshot)
    .values({
      postId: payload.id,
      title: payload.title,
      authorId: payload.authorId,
      forumSlug: payload.forumSlug,
      topped: payload.topped,
      locked: payload.locked,
      content: payload.content,
      pinnedReplyId: payload.pinnedReplyId,
      capturedAt: now,
      lastSeenAt: now,
      contentHash: hash,
    })
    .onConflictDoNothing();

  return { isNew: true };
}

/** 保存一组回复快照，返回新增（内容有变化）的数量。 */
export async function saveReplySnapshots(
  db: Db,
  payloads: ReplySnapshotInput[],
): Promise<number> {
  let numNew = 0;

  for (const reply of payloads) {
    const now = new Date(reply.time * 1000);
    const hash = await sha256Hex(reply.content);

    const [latest] = await db
      .select({
        capturedAt: schema.ReplySnapshot.capturedAt,
        contentHash: schema.ReplySnapshot.contentHash,
      })
      .from(schema.ReplySnapshot)
      .where(eq(schema.ReplySnapshot.replyId, reply.id))
      .orderBy(desc(schema.ReplySnapshot.capturedAt))
      .limit(1);

    if (latest && latest.contentHash === hash) {
      await db
        .update(schema.ReplySnapshot)
        .set({ lastSeenAt: now })
        .where(
          and(
            eq(schema.ReplySnapshot.replyId, reply.id),
            eq(schema.ReplySnapshot.capturedAt, latest.capturedAt),
          ),
        );
      continue;
    }

    await db
      .insert(schema.ReplySnapshot)
      .values({
        replyId: reply.id,
        content: reply.content,
        capturedAt: now,
        lastSeenAt: now,
        contentHash: hash,
      })
      .onConflictDoNothing();
    numNew++;
  }

  return numNew;
}

/** 某回复最新快照的 capturedAt（Unix 秒），无则 null。 */
export async function getLatestReplySnapshotAt(
  db: Db,
  replyId: number,
): Promise<number | null> {
  const [row] = await db
    .select({ capturedAt: schema.ReplySnapshot.capturedAt })
    .from(schema.ReplySnapshot)
    .where(eq(schema.ReplySnapshot.replyId, replyId))
    .orderBy(desc(schema.ReplySnapshot.capturedAt))
    .limit(1);
  return row ? Math.floor(row.capturedAt.getTime() / 1000) : null;
}
