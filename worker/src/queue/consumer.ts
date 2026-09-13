/**
 * 队列消费者：processJob 分发（对标原项目 apps/worker/src/jobs.ts）。
 */

import { fetchDiscuss } from "../../../src/crawler/discuss.js";
import { AccessError } from "../../../src/crawler/errors.js";
import { JOB_STALE_SECONDS, enqueue, jobLabel, type Job } from "../../../src/queue/jobs.js";
import type { WorkerEnv } from "../env.js";

/** 回填（向前翻页）时的入队延迟，用于平滑请求速率。 */
const BACKFILL_DELAY_SECONDS = 2;

export async function processJob(env: WorkerEnv, job: Job): Promise<void> {
  // 过期消息（含无时间戳的旧格式消息）直接丢弃，不执行、不再入队。
  if (!job.enqueuedAt || Date.now() / 1000 - job.enqueuedAt > JOB_STALE_SECONDS) {
    return;
  }
  switch (job.type) {
    case "discuss": {
      const id = job.id;
      const page = job.page ?? 1;

      const { numPages, recentReply, recentReplySnapshot } = await fetchDiscuss(
        env,
        id,
        page,
      );

      // 有最新回复但尚未归档 → 补抓最后一页
      if (recentReply && !recentReplySnapshot) {
        await enqueue(env, { type: "discuss", id, page: numPages });
      }

      // 链式向前翻页
      if (page > 1) {
        await enqueue(
          env,
          { type: "discuss", id, page: Math.min(page - 1, numPages) },
          { delaySeconds: BACKFILL_DELAY_SECONDS },
        );
      }
      break;
    }
  }
}

export async function handleQueue(
  batch: MessageBatch<Job>,
  env: WorkerEnv,
  _ctx: ExecutionContext,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await processJob(env, message.body);
      message.ack();
    } catch (error) {
      // 403/404 属永久性不可达（已删除/无权限），重试无意义，直接确认丢弃。
      if (error instanceof AccessError) {
        console.warn(
          `[queue] job not accessible, ack: ${jobLabel(message.body)}`,
          (error as Error).message,
        );
        message.ack();
        continue;
      }
      console.error(`[queue] job failed ${jobLabel(message.body)}`, error);
      message.retry({ delaySeconds: 30 });
    }
  }
}
