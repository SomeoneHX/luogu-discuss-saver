/**
 * 抓取任务类型与入队（Pages 与后台 Worker 共用）。
 *
 * - Pages（生产者）：用户点「抓取」或外部触发 → `enqueue(...)` 发消息。
 * - Worker（消费者）：消费队列 → processJob 执行抓取。
 */

import type { Env } from "../env.js";

export type Job = { type: "discuss"; id: number; page?: number };

export function jobLabel(job: Job): string {
  return `discuss:${String(job.id)}:${String(job.page ?? 1)}`;
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
