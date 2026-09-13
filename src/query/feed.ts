/**
 * 首页「社区精选」信息流（讨论子集）。
 *
 * 打分算法 1:1 对齐原版 packages/query/src/feed.ts：
 * - 候选：updatedAt 在近 14 天内的帖子（仅讨论）
 * - baseline = log1p(recentReplies * 1.8 + replyCount * 0.04)
 *   （recentReplies = 最近 3 天新增回复数）
 * - 时间衰减：36h 半衰期 exp(-ln2 * age / halfLife)
 * - 确定性抖动：0.4 + 0.6 * (sha256(seed + ":" + key) 前 4 字节 / 0xffffffff)
 * - 排序与游标：(score, timestamp, key) 降序，base64url JSON 游标
 */
import { and, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";

import { getDb, type Db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { getLuoguAvatar } from "./discussion.js";

const FEED_DEFAULT_LIMIT = 60;
const FEED_MAX_LIMIT = 80;
const RANDOM_MIN = 0.4;
const RANDOM_MAX = 1.0;

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DISCUSSION_LOOKBACK_MS = 14 * DAY_IN_MS;
const DISCUSSION_RECENT_REPLY_WINDOW_MS = 3 * DAY_IN_MS;
const FEED_TIME_DECAY_HALF_LIFE_MS = 36 * 60 * 60 * 1000; // 36h 半衰期

export interface FeedForumInfo {
  slug: string;
  name: string;
  problem: {
    pid: string;
    title: string | null;
    difficulty: number | null;
  } | null;
}

export interface FeedAuthorInfo {
  id: number;
  name: string;
  avatar: string;
  badge: string | null;
  color: string;
  ccfLevel: number;
  xcpcLevel: number;
}

export interface DiscussionFeedEntry {
  kind: "discussion";
  key: string;
  timestamp: string;
  author: FeedAuthorInfo | null;
  postId: number;
  title: string;
  content: string | null;
  forum: FeedForumInfo;
  replyCount: number;
  recentReplyCount: number;
}

export interface FeedPage {
  seed: string;
  items: DiscussionFeedEntry[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface FeedCursor {
  seed: string;
  score: number;
  timestamp: number;
  key: string;
}

function generateSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function computeDeterministicJitter(
  seed: string,
  key: string,
): Promise<number> {
  const data = new TextEncoder().encode(`${seed}:${key}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  const view = new DataView(digest.buffer);
  const value = view.getUint32(0) / 0xffffffff;
  return RANDOM_MIN + (RANDOM_MAX - RANDOM_MIN) * value;
}

function encodeFeedCursor(payload: FeedCursor): string {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function parseFeedCursor(raw: string | null): FeedCursor | null {
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(
      atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)),
    ) as Partial<FeedCursor>;
    if (
      typeof payload.seed !== "string" ||
      typeof payload.score !== "number" ||
      typeof payload.timestamp !== "number" ||
      typeof payload.key !== "string"
    ) {
      return null;
    }
    return payload as FeedCursor;
  } catch {
    return null;
  }
}

export async function getFeedPage(
  db: Db,
  {
    limit = FEED_DEFAULT_LIMIT,
    cursor,
  }: { limit?: number; cursor?: string | null } = {},
): Promise<FeedPage> {
  const clampedLimit = Math.min(Math.max(limit, 1), FEED_MAX_LIMIT);
  const parsedCursor = parseFeedCursor(cursor ?? null);
  const seed = parsedCursor?.seed ?? generateSeed();
  const now = Date.now();

  const lookbackSince = new Date(now - DISCUSSION_LOOKBACK_MS);
  const recentSince = new Date(now - DISCUSSION_RECENT_REPLY_WINDOW_MS);

  // 近 14 天有更新的帖子 + 最新快照（含作者最新用户快照与板块/题目）
  const posts = await db.query.Post.findMany({
    where: gte(schema.Post.updatedAt, lookbackSince),
    with: {
      snapshots: {
        orderBy: desc(schema.PostSnapshot.capturedAt),
        limit: 1,
        with: {
          author: {
            with: {
              snapshots: {
                orderBy: desc(schema.UserSnapshot.capturedAt),
                limit: 1,
              },
            },
          },
          forum: { with: { problem: true } },
        },
      },
    },
  });

  // 最近 3 天回复数
  const recentRows = await db
    .select({
      postId: schema.Reply.postId,
      total: sql<number>`COUNT(*)`.mapWith(Number),
    })
    .from(schema.Reply)
    .where(gte(schema.Reply.time, recentSince))
    .groupBy(schema.Reply.postId);
  const recentMap = new Map(recentRows.map((r) => [r.postId, r.total]));

  const seeds: {
    key: string;
    timestamp: Date;
    score: number;
    entry: DiscussionFeedEntry;
  }[] = [];

  for (const post of posts) {
    const snapshot = post.snapshots[0];
    const updatedAt = post.updatedAt ?? post.time;
    if (!snapshot?.title || !snapshot.forumSlug) continue;
    const timestamp = new Date(updatedAt);
    if (Number.isNaN(timestamp.getTime())) continue;

    const replyCount = post.replyCount ?? 0;
    const recentReplyCount = recentMap.get(post.id) ?? 0;
    const baseline = Math.log1p(
      Math.max(0, recentReplyCount * 1.8 + replyCount * 0.04),
    );
    if (baseline <= 0) continue;

    const key = `discussion:${post.id}`;
    const ageMs = Math.max(0, now - timestamp.getTime());
    const decay = Math.exp(
      (-Math.log(2) * ageMs) / FEED_TIME_DECAY_HALF_LIFE_MS,
    );
    const jitter = await computeDeterministicJitter(seed, key);
    const score = baseline * decay * jitter;
    if (!Number.isFinite(score) || score <= 0) continue;

    const authorSnap = snapshot.author?.snapshots[0];
    const forumProblem = snapshot.forum?.problem ?? null;

    seeds.push({
      key,
      timestamp,
      score,
      entry: {
        kind: "discussion",
        key,
        timestamp: timestamp.toISOString(),
        author: authorSnap
          ? {
              id: snapshot.authorId,
              name: authorSnap.name,
              avatar: getLuoguAvatar(snapshot.authorId),
              badge: authorSnap.badge,
              color: authorSnap.color,
              ccfLevel: authorSnap.ccfLevel,
              xcpcLevel: authorSnap.xcpcLevel,
            }
          : null,
        postId: post.id,
        title: snapshot.title,
        content: snapshot.content ?? null,
        forum: {
          slug: snapshot.forumSlug,
          name: snapshot.forum?.name ?? snapshot.forumSlug,
          problem: forumProblem
            ? {
                pid: forumProblem.pid,
                title: forumProblem.title,
                difficulty: forumProblem.difficulty,
              }
            : null,
        },
        replyCount,
        recentReplyCount,
      },
    });
  }

  // (score, timestamp, key) 降序
  seeds.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const diff = b.timestamp.getTime() - a.timestamp.getTime();
    if (diff !== 0) return diff;
    return a.key.localeCompare(b.key);
  });

  const filtered = parsedCursor
    ? seeds.filter((c) => {
        if (c.score !== parsedCursor.score)
          return c.score > parsedCursor.score;
        const t = c.timestamp.getTime();
        if (t !== parsedCursor.timestamp) return t > parsedCursor.timestamp;
        if (c.key === parsedCursor.key) return false;
        return c.key > parsedCursor.key;
      })
    : seeds;

  const items = filtered.slice(0, clampedLimit);
  const hasMore = filtered.length > clampedLimit;
  const lastItem = hasMore ? items[items.length - 1] : null;
  const nextCursor =
    hasMore && lastItem
      ? encodeFeedCursor({
          seed,
          score: lastItem.score,
          timestamp: lastItem.timestamp.getTime(),
          key: lastItem.key,
        })
      : null;

  return { seed, items: items.map((c) => c.entry), hasMore, nextCursor };
}
