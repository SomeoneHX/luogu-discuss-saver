/**
 * 运维任务（长期维护）：判定与执行都在 Worker 内完成。
 *
 * 触发方式：运维侧只往 D1 的 MaintenanceTask 插一条 status='pending' 的记录，
 * Worker 的小时级 cron 会把它投进队列，由消费者串行执行并把结果回写同一行。
 * 因此不存在任何长驻本机的脚本，也没有面向公网的运维端点。
 */

import { and, eq, inArray, lt, or, sql } from "drizzle-orm";

import { getDb, schema, type Db } from "../../src/db/client.js";
import { chunkRows } from "../../src/crawler/utils.js";
import { enqueue, type MaintenanceOp } from "../../src/queue/jobs.js";
import type { WorkerEnv } from "./env.js";

/** 只处理静置超过该时长的帖子：避免删掉正在进行中的抓取刚写下的维度行。 */
const ORPHAN_MIN_AGE_SECONDS = 600;
/** 单轮最多处理多少个帖子（幂等，可重复触发继续清理）。 */
const MAX_POSTS_PER_RUN = 200;
/** 明细里最多记录多少条，避免 detail 字段过大。 */
const MAX_DETAIL_ENTRIES = 100;

export interface MaintenanceResult {
  taskId: number;
  op: MaintenanceOp;
  scanned: number;
  deletedPosts: number;
  deletedReplies: number;
  deletedReplySnapshots: number;
}

/** 消费者入口：执行一条维护任务并回写状态/结果。 */
export async function runMaintenance(
  env: WorkerEnv,
  taskId: number,
  op: MaintenanceOp,
): Promise<MaintenanceResult> {
  const db = getDb(env);
  const [task] = await db
    .select({ id: schema.MaintenanceTask.id, status: schema.MaintenanceTask.status })
    .from(schema.MaintenanceTask)
    .where(eq(schema.MaintenanceTask.id, taskId))
    .limit(1);
  if (!task) throw new Error(`MaintenanceTask ${String(taskId)} not found`);
  if (task.status === "done") {
    return {
      taskId,
      op,
      scanned: 0,
      deletedPosts: 0,
      deletedReplies: 0,
      deletedReplySnapshots: 0,
    };
  }

  await db
    .update(schema.MaintenanceTask)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(schema.MaintenanceTask.id, taskId));

  try {
    const result =
      op === "purge-orphan-posts"
        ? await purgeOrphanPosts(db)
        : (() => {
            throw new Error(`unknown maintenance op: ${String(op)}`);
          })();

    await db
      .update(schema.MaintenanceTask)
      .set({
        status: "done",
        finishedAt: new Date(),
        scanned: result.scanned,
        deletedPosts: result.deletedPosts,
        deletedReplies: result.deletedReplies,
        deletedReplySnapshots: result.deletedReplySnapshots,
        detail: result.detail,
      })
      .where(eq(schema.MaintenanceTask.id, taskId));

    return { taskId, op, ...result };
  } catch (error) {
    await db
      .update(schema.MaintenanceTask)
      .set({ status: "failed", finishedAt: new Date(), detail: String(error) })
      .where(eq(schema.MaintenanceTask.id, taskId));
    throw error;
  }
}

/**
 * 清理「只有维度行、从未落过任何快照」的帖子——这是写入被中断（配额耗尽、
 * 部署打断在途调用）留下的半截产物：帖子页会把它们当作未收录，列表页也无法展示。
 *
 * 判定与删除都在一条带 `not exists` 守卫的语句里完成，因此即使有抓取任务刚好
 * 在这个窗口内为该帖写入快照，也不会误删。
 */
async function purgeOrphanPosts(db: Db): Promise<{
  scanned: number;
  deletedPosts: number;
  deletedReplies: number;
  deletedReplySnapshots: number;
  detail: string;
}> {
  const cutoff = new Date(Date.now() - ORPHAN_MIN_AGE_SECONDS * 1000);
  const noSnapshot = sql`not exists (select 1 from ${schema.PostSnapshot} where ${schema.PostSnapshot.postId} = ${schema.Post.id})`;

  const candidates = await db
    .select({ id: schema.Post.id })
    .from(schema.Post)
    .where(and(lt(schema.Post.updatedAt, cutoff), noSnapshot))
    .limit(MAX_POSTS_PER_RUN);

  let deletedPosts = 0;
  let deletedReplies = 0;
  let deletedReplySnapshots = 0;
  const detail: { id: number; replies: number; snapshots: number }[] = [];

  for (const post of candidates) {
    const replies = await db
      .select({ id: schema.Reply.id })
      .from(schema.Reply)
      .where(eq(schema.Reply.postId, post.id));

    let snapshots = 0;
    for (const chunk of chunkRows(replies.map((r) => ({ id: r.id })))) {
      const removed = await db
        .delete(schema.ReplySnapshot)
        .where(
          inArray(
            schema.ReplySnapshot.replyId,
            chunk.map((c) => c.id),
          ),
        )
        .returning({ replyId: schema.ReplySnapshot.replyId });
      snapshots += removed.length;
    }

    const removedReplies = await db
      .delete(schema.Reply)
      .where(eq(schema.Reply.postId, post.id))
      .returning({ id: schema.Reply.id });

    // 守卫放在删除语句本身：期间若已写入快照，则该行不再匹配，帖子会被保留
    const removedPosts = await db
      .delete(schema.Post)
      .where(and(eq(schema.Post.id, post.id), noSnapshot))
      .returning({ id: schema.Post.id });

    if (!removedPosts.length) continue;

    deletedPosts += 1;
    deletedReplies += removedReplies.length;
    deletedReplySnapshots += snapshots;
    if (detail.length < MAX_DETAIL_ENTRIES) {
      detail.push({
        id: post.id,
        replies: removedReplies.length,
        snapshots,
      });
    }
  }

  return {
    scanned: candidates.length,
    deletedPosts,
    deletedReplies,
    deletedReplySnapshots,
    detail: JSON.stringify(detail),
  };
}

/**
 * cron 唤醒时把待执行的维护任务投进队列（与自动发现的概率/夜间规则无关：
 * 维护任务不访问洛谷，只动自家数据）。
 */
export async function dispatchPendingMaintenance(env: WorkerEnv): Promise<number> {
  const db = getDb(env);
  // pending，或长时间卡在 queued 且从未开始（例如投递后消费者被中断）
  const stalledCutoff = new Date(Date.now() - 2 * 3600_000);
  const rows = await db
    .select({
      id: schema.MaintenanceTask.id,
      op: schema.MaintenanceTask.op,
    })
    .from(schema.MaintenanceTask)
    .where(
      or(
        eq(schema.MaintenanceTask.status, "pending"),
        and(
          eq(schema.MaintenanceTask.status, "queued"),
          lt(schema.MaintenanceTask.requestedAt, stalledCutoff),
        ),
      ),
    )
    .orderBy(schema.MaintenanceTask.id)
    .limit(5);

  for (const row of rows) {
    await enqueue(env, {
      type: "maintenance",
      taskId: row.id,
      op: row.op as MaintenanceOp,
    });
    await db
      .update(schema.MaintenanceTask)
      .set({ status: "queued" })
      .where(eq(schema.MaintenanceTask.id, row.id));
  }
  return rows.length;
}
