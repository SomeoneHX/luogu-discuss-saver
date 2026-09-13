import type { PostLocker } from "./durable/postLocker.js";
import type { Env } from "../../src/env.js";
import type { Job } from "../../src/queue/jobs.js";

/**
 * 后台 Worker 的绑定。相对共用 Env：
 *   - CRAWL_QUEUE 必绑（生产者 + 消费者）
 *   - POST_LOCKER 必绑（DO 类在本 Worker 内定义）
 */
export interface WorkerEnv extends Env {
  CRAWL_QUEUE: Queue<Job>;
  POST_LOCKER: DurableObjectNamespace<PostLocker>;
}
