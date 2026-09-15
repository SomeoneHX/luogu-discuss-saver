/**
 * 自动发现轮（低频率 + 随机化）。
 *
 * 设计目标：让「活跃讨论的追更」自动进行，同时把成本与风控暴露面压到最低：
 *   1) 低频唤醒：cron 每小时一次，真正执行由概率骰子决定（默认 1/3）→ 平均约 3 小时一轮；
 *   2) 时刻随机：掷骰通过后，发现任务本身带 0~30 分钟随机延迟入队 → 执行时刻无固定节律；
 *   3) 夜间不做（默认概率 0）：避开「昼夜不停」的机器画像；
 *   4) 置顶帖跳过：它们曝光高，靠用户手动更新即可；
 *   5) delta 闸门：仅当「洛谷回复数 − 已归档数 ≥ REPLY_DELTA_THRESHOLD」才入队；
 *   6) 按帖冷却：冷却时长 = max(下限, 帖子页数 × 每页耗时估算)，避免同帖链条重叠重跑；
 *   7) 单轮限量：一轮最多入队 DISCOVERY_MAX_POSTS 个帖子，入队时各自随机错峰。
 */

import {
  fetchDiscussList,
  getExistingPostIds,
  getPostLastSeenAt,
  getSavedReplyCounts,
} from "../../src/crawler/discuss.js";
import { getDb } from "../../src/db/client.js";
import { enqueue } from "../../src/queue/jobs.js";
import type { PostSummary } from "../../src/crawler/types.js";
import type { WorkerEnv } from "./env.js";

export interface DiscoveryConfig {
  listPages: number;
  maxPosts: number;
  cooldownSeconds: number;
  secondsPerPage: number;
  deltaThreshold: number;
  staggerMaxSeconds: number;
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readDiscoveryConfig(env: WorkerEnv): DiscoveryConfig {
  return {
    listPages: Math.max(1, num(env.DISCOVERY_LIST_PAGES, 2)),
    maxPosts: Math.max(1, num(env.DISCOVERY_MAX_POSTS, 5)),
    cooldownSeconds: Math.max(0, num(env.DISCOVERY_POST_COOLDOWN_SECONDS, 1800)),
    secondsPerPage: Math.max(0, num(env.DISCOVERY_SECONDS_PER_PAGE, 20)),
    deltaThreshold: Math.max(0, num(env.REPLY_DELTA_THRESHOLD, 5)),
    staggerMaxSeconds: Math.max(0, num(env.DISCOVERY_STAGGER_MAX_SECONDS, 30)),
  };
}

export interface DiscoveryResult {
  scanned: number;
  topped: number;
  fresh: number;
  belowDelta: number;
  cooling: number;
  enqueued: number;
  enqueuedIds: number[];
}

/** 执行一轮发现：只读列表 + 读 D1 现状，命中闸门的帖子入队抓取。 */
export async function runDiscovery(env: WorkerEnv): Promise<DiscoveryResult> {
  const config = readDiscoveryConfig(env);
  const result: DiscoveryResult = {
    scanned: 0,
    topped: 0,
    fresh: 0,
    belowDelta: 0,
    cooling: 0,
    enqueued: 0,
    enqueuedIds: [],
  };

  // 1) 拉列表（不落库：发现轮只做判定，写入交给抓取任务）
  const summaries: PostSummary[] = [];
  for (let page = 1; page <= config.listPages; page += 1) {
    const { posts } = await fetchDiscussList(env, null, page);
    if (!posts.length) break;
    summaries.push(...posts);
  }
  result.scanned = summaries.length;
  if (!summaries.length) return result;

  // 2) 置顶帖跳过
  const candidates = summaries.filter((post) => {
    if (post.topped) {
      result.topped += 1;
      return false;
    }
    return true;
  });
  if (!candidates.length) return result;

  const ids = candidates.map((post) => post.id);
  const db = getDb(env);
  const [existing, savedCounts, lastSeen] = await Promise.all([
    getExistingPostIds(db, ids),
    getSavedReplyCounts(db, ids),
    getPostLastSeenAt(db, ids),
  ]);

  const now = Date.now();

  // 3) 逐个判定
  for (const post of candidates) {
    if (result.enqueued >= config.maxPosts) break;

    const saved = savedCounts.get(post.id) ?? 0;
    const isNew = !existing.has(post.id);

    if (!isNew) {
      const delta = post.replyCount - saved;
      if (delta < config.deltaThreshold) {
        result.belowDelta += 1;
        continue;
      }
      // 按帖冷却：帖子越大，链条越长，冷却越长（避免重叠重跑）
      const pages = Math.ceil(post.replyCount / 10);
      const cooldownMs =
        Math.max(config.cooldownSeconds, pages * config.secondsPerPage) * 1000;
      const seenAt = lastSeen.get(post.id);
      if (seenAt && now - seenAt.getTime() < cooldownMs) {
        result.cooling += 1;
        continue;
      }
    } else {
      result.fresh += 1;
    }

    const delayed = Math.floor(Math.random() * (config.staggerMaxSeconds + 1));
    await enqueue(
      env,
      { type: "discuss", id: post.id },
      delayed > 0 ? { delaySeconds: delayed } : {},
    );
    result.enqueued += 1;
    result.enqueuedIds.push(post.id);
  }

  return result;
}
