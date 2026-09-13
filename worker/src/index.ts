/**
 * 后台 Worker 入口：队列消费 + Durable Object 托管。
 *
 * 该 Worker 没有面向用户的 HTTP 入口（fetch 仅返回标识），因此
 * 「Workers 国内不可达」不影响它——国内用户只访问 Pages。
 */

import type { Job } from "../../src/queue/jobs.js";
import type { WorkerEnv } from "./env.js";
import { handleQueue } from "./queue/consumer.js";

export { PostLocker } from "./durable/postLocker.js";

export default {
  fetch(): Response {
    return new Response(
      "lgds-jobs: background worker (queue + durable objects)\n",
      { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  },
  queue: handleQueue,
} satisfies ExportedHandler<WorkerEnv, Job>;
