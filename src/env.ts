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
  /** 按帖冷却秒数：距上次快照确认不足该值时拒绝重复触发（0=关闭）。 */
  CRAWL_COOLDOWN_SECONDS?: string;
  /** 旧帖增量抓取阈值，默认 5。 */
  REPLY_DELTA_THRESHOLD?: string;

  // ---- 自动发现（低频率 + 随机化）----
  /** 总开关，字符串 "true" 才启用。 */
  DISCOVERY_ENABLED?: string;
  /** 每次 cron 唤醒真正执行发现轮的概率（0~1），默认 0.33。 */
  DISCOVERY_PROBABILITY?: string;
  /** 夜间（北京时间 0~7 点）执行概率，默认 0（不做昼夜不停的机器）。 */
  DISCOVERY_NIGHT_PROBABILITY?: string;
  /** 发现轮随机延迟上限（秒），把执行时刻打散，默认 1800。 */
  DISCOVERY_DELAY_MAX_SECONDS?: string;
  /**
   * 发现轮定向抓取的版块 slug（逗号分隔），如 "academics,siteaffairs,service"。
   * 留空/不设 = 抓混合列表（`/discuss` 不带 forum 参数，含各题目讨论区）。
   * 题目讨论区只能发在具体题目下（题目总榜 `problem` 是聚合视图，不可单独发帖），
   * 而账号未提交过的题目其讨论区一律 403，故默认只扫可稳定获取的版块。
   */
  DISCOVERY_FORUMS?: string;
  /** 发现轮**每个版块**读取的列表页数（未设 DISCOVERY_FORUMS 时按整体页数算），默认 2。 */
  DISCOVERY_LIST_PAGES?: string;
  /** 单轮最多入队多少个帖子，默认 5。 */
  DISCOVERY_MAX_POSTS?: string;
  /** 按帖冷却下限（秒），默认 1800。 */
  DISCOVERY_POST_COOLDOWN_SECONDS?: string;
  /** 估算每页抓取耗时（秒），用于按帖子规模放大冷却，默认 20。 */
  DISCOVERY_SECONDS_PER_PAGE?: string;
  /** 入队时的随机错峰上限（秒），默认 30。 */
  DISCOVERY_STAGGER_MAX_SECONDS?: string;
}
