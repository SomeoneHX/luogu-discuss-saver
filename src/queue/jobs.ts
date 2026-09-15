/**
 * 抓取任务类型与入队（Pages 与后台 Worker 共用）。
 *
 * - Pages（生产者）：用户点「抓取」或外部触发 → `enqueue(...)` 发消息。
 * - Worker（消费者）：消费队列 → processJob 执行抓取。
 */

import type { Env } from "../env.js";

export type DiscussJob = { type: "discuss"; id: number; page?: number };
/** 发现轮：拉取讨论列表，挑出落后/新增的帖子并入队抓取。 */
export type DiscoverJob = { type: "discover" };
/** 运维任务：长期维护的执行入口，判定与执行都在 Worker 内完成。 */
export type MaintenanceOp = "purge-orphan-posts";
export type MaintenanceJob = {
  type: "maintenance";
  taskId: number;
  op: MaintenanceOp;
};
export type Job = DiscussJob | DiscoverJob | MaintenanceJob;

export function jobLabel(job: Job): string {
  switch (job.type) {
    case "discover":
      return "discover";
    case "maintenance":
      return `maintenance:${String(job.taskId)}:${job.op}`;
    default:
      return `discuss:${String(job.id)}:${String(job.page ?? 1)}`;
  }
}

export interface EnqueueOptions {
  delaySeconds?: number;
}

/** 发消息到抓取队列。返回 false 表示当前运行时未绑定队列。 */
export async function enqueue(
  env: Pick<Env, "CRAWL_QUEUE">,
  job: Job,
  options: EnqueueOptions = {},
): Promise<boolean> {
  if (!env.CRAWL_QUEUE) return false;
  await env.CRAWL_QUEUE.send(job, {
    contentType: "json",
    ...(options.delaySeconds ? { delaySeconds: options.delaySeconds } : {}),
  });
  return true;
}
