/**
 * 用户页读取查询层（D1 版）。
 * 对应原项目 packages/query/src/user-profile.ts —— 仅保留讨论相关：
 * profile / usernameHistory / timeline（发帖 + 回帖），文章/剪贴板/判决剔除。
 */

import { and, count, desc, eq, inArray, lte, sql } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import { getLuoguAvatar } from "./discussion.js";

const USERNAME_HISTORY_LIMIT = 120;
const TIMELINE_PAGE_DEFAULT_LIMIT = 30;
const TIMELINE_PAGE_MAX_LIMIT = 60;
const TIMELINE_FETCH_BUFFER = 20;

export type UserNameColor =
  | "purple"
  | "red"
  | "orange"
  | "green"
  | "blue"
  | "gray"
  | "cheater";

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl: string;
  nameColor: UserNameColor;
  badge?: string | undefined;
  ccfLevel?: number | undefined;
  xcpcLevel?: number | undefined;
  slogan: string;
  stats: {
    posts: number;
    articles: number;
    interactions: number;
    judgements: number;
    bens: number;
    articleUpvotes: number;
    articleFavorites: number;
  };
  tags: string[];
}

export interface UsernameHistoryEntry {
  id: string;
  username: string;
  changedAt: string;
  note?: string | undefined;
  snapshot: {
    id: number;
    name: string;
    color: string;
    badge: string | null;
    ccfLevel: number;
    xcpcLevel: number;
  };
}

export type TimelineEntry =
  | {
      id: string;
      type: "discussion";
      title: string;
      summary: string;
      href: string;
      replies: number;
      participants: number;
      createdAt: string;
    }
  | {
      id: string;
      type: "discussionReply";
      discussionTitle: string;
      excerpt: string;
      href: string;
      createdAt: string;
    };

export interface UserTimelinePage {
  entries: TimelineEntry[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface UserProfileBundle {
  profile: UserProfile;
  usernameHistory: UsernameHistoryEntry[];
  related: never[];
  timeline: TimelineEntry[];
  timelineHasMore: boolean;
  timelineNextCursor: string | null;
}

function truncateContent(value: string, limit = 160): string {
  const normalized = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "（暂无内容）";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trim()}…`;
}

function sanitizeBadge(badge?: string | null): string | null {
  if (!badge) return null;
  const text = badge.replace(/<[^>]*>/g, "").trim();
  return text || null;
}

function mapColorToToken(color: string): UserNameColor {
  return color.toLowerCase() as UserNameColor;
}

async function getUserStats(db: Db, userId: number) {
  const [postStats, replyStats] = await Promise.all([
    db
      .select({ total: sql<number>`count(distinct ${schema.PostSnapshot.postId})`.mapWith(Number) })
      .from(schema.PostSnapshot)
      .where(eq(schema.PostSnapshot.authorId, userId)),
    db
      .select({ total: count() })
      .from(schema.Reply)
      .where(eq(schema.Reply.authorId, userId)),
  ]);

  const interactions = replyStats[0]?.total ?? 0;
  return {
    posts: postStats[0]?.total ?? 0,
    articles: 0,
    interactions,
    judgements: 0,
    bens: 0,
    articleUpvotes: 0,
    articleFavorites: 0,
  };
}

export async function getUserProfileBundle(
  db: Db,
  userId: number,
): Promise<UserProfileBundle | null> {
  if (!Number.isFinite(userId)) return null;

  const snapshots = await db
    .select()
    .from(schema.UserSnapshot)
    .where(eq(schema.UserSnapshot.userId, userId))
    .orderBy(desc(schema.UserSnapshot.capturedAt))
    .limit(Math.max(USERNAME_HISTORY_LIMIT, 1));

  const latestSnapshot = snapshots[0];
  if (!latestSnapshot) return null;

  const [stats, timelinePage] = await Promise.all([
    getUserStats(db, userId),
    getUserTimelinePage(db, userId, { limit: TIMELINE_PAGE_DEFAULT_LIMIT }),
  ]);

  const tags: string[] = [];
  if (latestSnapshot.isRoot) tags.push("超级管理员");
  if (latestSnapshot.isAdmin) tags.push("管理员");
  if (latestSnapshot.isBanned) tags.push("已封禁");

  const profile: UserProfile = {
    id: userId.toString(),
    name: latestSnapshot.name,
    avatarUrl: getLuoguAvatar(userId),
    nameColor: mapColorToToken(latestSnapshot.color),
    badge: sanitizeBadge(latestSnapshot.badge) ?? undefined,
    ccfLevel: latestSnapshot.ccfLevel || undefined,
    xcpcLevel: latestSnapshot.xcpcLevel || undefined,
    slogan: latestSnapshot.slogan || "这名用户暂未设置签名。",
    stats,
    tags,
  };

  const usernameHistory: UsernameHistoryEntry[] = snapshots.map((s) => ({
    id: `${String(s.userId)}-${s.capturedAt.getTime().toString()}`,
    username: s.name,
    changedAt: s.capturedAt.toISOString(),
    note: s.slogan.trim() || undefined,
    snapshot: {
      id: s.userId,
      name: s.name,
      color: s.color,
      badge: sanitizeBadge(s.badge),
      ccfLevel: s.ccfLevel,
      xcpcLevel: s.xcpcLevel,
    },
  }));

  return {
    profile,
    usernameHistory,
    related: [],
    timeline: timelinePage?.entries ?? [],
    timelineHasMore: timelinePage?.hasMore ?? false,
    timelineNextCursor: timelinePage?.nextCursor ?? null,
  };
}

export interface UserTimelineCursor {
  timestamp: Date;
  entryId: string;
}

export function parseUserTimelineCursor(cursor: string): UserTimelineCursor | null {
  if (!cursor) return null;
  const separatorIndex = cursor.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex === cursor.length - 1) return null;
  const millis = Number.parseInt(cursor.slice(0, separatorIndex), 36);
  if (!Number.isFinite(millis) || millis <= 0) return null;
  return { timestamp: new Date(millis), entryId: cursor.slice(separatorIndex + 1) };
}

function encodeUserTimelineCursor(entry: TimelineEntry): string {
  const millis = new Date(entry.createdAt).getTime();
  return `${millis.toString(36)}:${entry.id}`;
}

function isEntryBeforeCursor(entry: TimelineEntry, cursor: UserTimelineCursor) {
  const entryTime = new Date(entry.createdAt).getTime();
  const cursorTime = cursor.timestamp.getTime();
  if (entryTime < cursorTime) return true;
  if (entryTime > cursorTime) return false;
  return entry.id.localeCompare(cursor.entryId) > 0;
}

function compareTimelineEntriesDesc(a: TimelineEntry, b: TimelineEntry) {
  const timeDiff =
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (timeDiff !== 0) return timeDiff;
  return a.id.localeCompare(b.id);
}

async function getUserTimelineEntries(
  db: Db,
  userId: number,
  limit: number,
  before?: Date | null,
): Promise<TimelineEntry[]> {
  const postTimeFilter = before
    ? lte(schema.Post.time, before)
    : undefined;

  const postRows = await db
    .select({
      id: schema.Post.id,
      time: schema.Post.time,
      replyCount: schema.Post.replyCount,
    })
    .from(schema.PostSnapshot)
    .innerJoin(schema.Post, eq(schema.Post.id, schema.PostSnapshot.postId))
    .where(
      postTimeFilter
        ? and(
            eq(schema.PostSnapshot.authorId, userId),
            postTimeFilter,
          )
        : eq(schema.PostSnapshot.authorId, userId),
    )
    .groupBy(schema.Post.id)
    .orderBy(desc(sql`max(${schema.Post.time})`))
    .limit(limit);

  const postIds = postRows.map((row) => row.id);
  const postSnapshots = postIds.length
    ? await db
        .select()
        .from(schema.PostSnapshot)
        .where(inArray(schema.PostSnapshot.postId, postIds))
        .orderBy(desc(schema.PostSnapshot.capturedAt))
    : [];
  const latestPostSnap = new Map<number, (typeof postSnapshots)[number]>();
  for (const snap of postSnapshots) {
    if (!latestPostSnap.has(snap.postId)) latestPostSnap.set(snap.postId, snap);
  }

  const replyRows = await db
    .select({
      id: schema.Reply.id,
      postId: schema.Reply.postId,
      time: schema.Reply.time,
    })
    .from(schema.Reply)
    .where(
      before
        ? and(eq(schema.Reply.authorId, userId), lte(schema.Reply.time, before))
        : eq(schema.Reply.authorId, userId),
    )
    .orderBy(desc(schema.Reply.time))
    .limit(limit);

  const replyPostIds = [...new Set(replyRows.map((r) => r.postId))];
  const replyPostTitles = new Map<number, string>();
  if (replyPostIds.length) {
    const postRows2 = await db
      .select({ id: schema.Post.id })
      .from(schema.Post)
      .where(inArray(schema.Post.id, replyPostIds));
    const snaps = await db
      .select({ postId: schema.PostSnapshot.postId, title: schema.PostSnapshot.title })
      .from(schema.PostSnapshot)
      .where(inArray(schema.PostSnapshot.postId, postRows2.map((p) => p.id)))
      .orderBy(desc(schema.PostSnapshot.capturedAt));
    for (const snap of snaps) {
      if (!replyPostTitles.has(snap.postId)) replyPostTitles.set(snap.postId, snap.title);
    }
  }

  const replyContents = new Map<number, string>();
  const replySnapRows = replyRows.length
    ? await db
        .select()
        .from(schema.ReplySnapshot)
        .where(inArray(schema.ReplySnapshot.replyId, replyRows.map((r) => r.id)))
        .orderBy(desc(schema.ReplySnapshot.capturedAt))
    : [];
  for (const snap of replySnapRows) {
    if (!replyContents.has(snap.replyId)) replyContents.set(snap.replyId, snap.content);
  }

  const entries: TimelineEntry[] = [];

  for (const post of postRows) {
    const snapshot = latestPostSnap.get(post.id);
    if (!snapshot || snapshot.authorId !== userId) continue;
    entries.push({
      id: `discussion-${post.id.toString()}-${post.time.getTime().toString()}`,
      type: "discussion",
      title: snapshot.title,
      summary: truncateContent(snapshot.content),
      href: `/d/${post.id.toString()}`,
      replies: post.replyCount,
      participants: Math.max(1, Math.min(post.replyCount, 50)),
      createdAt: post.time.toISOString(),
    });
  }

  for (const reply of replyRows) {
    entries.push({
      id: `discussion-reply-${reply.id.toString()}`,
      type: "discussionReply",
      discussionTitle: replyPostTitles.get(reply.postId) ?? reply.postId.toString(),
      excerpt: truncateContent(replyContents.get(reply.id) ?? ""),
      href: `/d/${reply.postId.toString()}#reply-${reply.id.toString()}`,
      createdAt: reply.time.toISOString(),
    });
  }

  return entries.sort(compareTimelineEntriesDesc).slice(0, limit);
}

export async function getUserTimelinePage(
  db: Db,
  userId: number,
  options?: {
    cursor?: UserTimelineCursor | null;
    limit?: number;
  },
): Promise<UserTimelinePage | null> {
  if (!Number.isFinite(userId) || userId <= 0) return null;

  const requestedLimit = options?.limit ?? TIMELINE_PAGE_DEFAULT_LIMIT;
  const clampedLimit = Math.min(Math.max(1, requestedLimit), TIMELINE_PAGE_MAX_LIMIT);
  const fetchLimit = clampedLimit + TIMELINE_FETCH_BUFFER;
  const beforeDate = options?.cursor?.timestamp ?? null;

  const rawEntries = await getUserTimelineEntries(db, userId, fetchLimit, beforeDate);

  const cursor = options?.cursor ?? null;
  const filteredEntries = cursor
    ? rawEntries.filter((entry) => isEntryBeforeCursor(entry, cursor))
    : rawEntries;

  const hasMore = filteredEntries.length > clampedLimit;
  const entries = filteredEntries.slice(0, clampedLimit);
  const lastEntry = entries[entries.length - 1];
  const nextCursor =
    hasMore && lastEntry ? encodeUserTimelineCursor(lastEntry) : null;

  return { entries, hasMore, nextCursor };
}
