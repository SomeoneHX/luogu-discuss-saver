import type { PostLockerBinding } from "./durable/postLockerInterface.js";
import type { Job } from "./queue/jobs.js";

/**
 * 共用绑定与变量。Pages Functions 与后台 Worker 都满足该结构：
 *   - Pages：必绑 DB；可选 CRAWL_QUEUE（producer）。**不绑** POST_LOCKER
 *     → 共用逻辑自动回退 contentHash 幂等写入。
 *   - Worker（后台）：必绑 DB、CRAWL_QUEUE（producer+consumer）、POST_LOCKER
 *     → 快照写入走 Durable Object 严格串行。
 */
export interface Env {
  DB: D1Database;
  /** 队列生产者（发抓取任务）。 */
  CRAWL_QUEUE?: Queue<Job>;
  /** 快照串行化 Durable Object；缺失时共用逻辑回退 contentHash 幂等。 */
  POST_LOCKER?: PostLockerBinding;
  /** 洛谷小号完整 Cookie（__client_id + _uid）。 */
  LUOGU_COOKIE?: string;
  /** 单账号请求间隔下限（毫秒），默认 6000。 */
  CRAWL_MIN_INTERVAL_MS?: string;
  /** 旧帖增量抓取阈值，默认 5。 */
  REPLY_DELTA_THRESHOLD?: string;
}
