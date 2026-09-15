/**
 * 后台 Worker 入口：队列消费 + Durable Object 托管。
 *
 * 该 Worker 没有面向用户的 HTTP 入口（fetch 仅返回标识），因此
 * 「Workers 国内不可达」不影响它——国内用户只访问 Pages。
 */

import { enqueue, type Job } from "../../src/queue/jobs.js";
import type { WorkerEnv } from "./env.js";
import { handleQueue } from "./queue/consumer.js";

/** 夜间（北京时间）时段：0~7 点不做自动发现，避免「昼夜不停」的机器画像。 */
const NIGHT_HOURS = new Set([0, 1, 2, 3, 4, 5, 6]);

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * 定时唤醒：掷骰决定是否执行发现轮，并给发现任务加 0~N 秒随机延迟。
 *
 * cron 本身是固定节律（每小时整点），但唤醒后先掷骰、通过后入队一条带随机延迟的
 * 发现任务——真正访问洛谷的时刻是随机的，且大多数唤醒不产生任何洛谷请求。
 */
async function handleScheduled(env: WorkerEnv, scheduledTime: number): Promise<void> {
  if (env.DISCOVERY_ENABLED !== "true") return;

  const beijingHour = new Date(scheduledTime + 8 * 3600_000).getUTCHours();
  const isNight = NIGHT_HOURS.has(beijingHour);
  const probability = isNight
    ? num(env.DISCOVERY_NIGHT_PROBABILITY, 0)
    : num(env.DISCOVERY_PROBABILITY, 0.33);
  if (probability <= 0 || Math.random() >= probability) return;

  const delayMax = Math.max(0, num(env.DISCOVERY_DELAY_MAX_SECONDS, 1800));
  const delay = delayMax > 0 ? Math.floor(Math.random() * (delayMax + 1)) : 0;
  await enqueue(env, { type: "discover" }, delay > 0 ? { delaySeconds: delay } : {});
  console.log(`[scheduled] discovery queued (delay ${String(delay)}s, night=${String(isNight)})`);
}

export { PostLocker } from "./durable/postLocker.js";

export default {
  fetch(): Response {
    return new Response(
      "lgds-jobs: background worker (queue + durable objects)\n",
      { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  },
  queue: handleQueue,
  scheduled(controller, env, ctx) {
    ctx.waitUntil(handleScheduled(env, controller.scheduledTime));
  },
} satisfies ExportedHandler<WorkerEnv, Job>;
