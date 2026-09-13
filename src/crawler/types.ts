/**
 * 洛谷讨论帖相关的响应类型（原项目使用 @lgjs/types，这里按其用法精简自建）。
 * 字段名与洛谷 lentille 返回保持一致（uid / pid / replyCount 等）。
 */

import type { UserColor } from "../db/schema.js";

export interface UserSummary {
  uid: number;
  name: string;
  slogan?: string | null;
  badge?: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  isRoot?: boolean;
  color: UserColor | string;
  ccfLevel: number;
  xcpcLevel: number;
  background?: string | null;
  avatar?: string | null;
}

export interface ProblemSummary {
  pid: string;
  /** 部分取数入口（如讨论列表）可能不返回题面标题，故可空。 */
  title: string | null;
  difficulty: number | null;
}

export interface ForumSummary {
  name: string;
  slug: string;
  type?: number | null;
  color?: string | null;
  problem?: ProblemSummary | null;
}

export interface ReplySummary {
  id: number;
  author: UserSummary;
  time: number;
  content: string;
}

/** 列表页里的帖子摘要（discuss.list）。 */
export interface PostSummary {
  id: number;
  time: number;
  replyCount: number;
  topped: boolean;
  locked: boolean;
  author: UserSummary;
  forum: ForumSummary;
  recentReply?: ReplySummary | null;
}

/** 详情页里的帖子（discuss.show）。 */
export interface PostDetails extends PostSummary {
  title: string;
  content: string;
  pinnedReply?: ReplySummary | null;
}

export interface ReplyListResult {
  count: number;
  perPage?: number | null;
  /** 洛谷已出现「对象化」趋势：可能是数组，也可能是以 id 为键的对象。 */
  result: ReplySummary[] | Record<string, ReplySummary>;
}

/** discuss.show 的 data 部分。 */
export interface DiscussShowData {
  post: PostDetails;
  replies: ReplyListResult;
  /** 最近回复（列表视图下可能只有 id/author/time，无 content）。 */
  recentReply?: ReplySummary | null;
}

/** discuss.list 的 data 部分。 */
export interface DiscussListData {
  posts: {
    count: number;
    perPage?: number | null;
    result: PostSummary[];
  };
}

/**
 * 把 replies.result 统一成数组（兼容对象化）。
 */
export function normalizeReplies(
  result: ReplySummary[] | Record<string, ReplySummary> | null | undefined,
): ReplySummary[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  return Object.values(result);
}
