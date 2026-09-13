export interface AuthorInfo {
  id: number;
  name: string;
  avatar: string;
  badge: string | null;
  color: string;
  ccfLevel: number;
  xcpcLevel: number;
}

export interface ForumInfo {
  slug: string;
  name: string;
  problemId: string | null;
  problem?: {
    pid: string;
    title: string | null;
    difficulty: number | null;
  } | null;
}

export interface PostCard {
  id: number;
  title: string;
  content: string;
  time: number;
  replyCount: number;
  forum: ForumInfo | null;
  author: AuthorInfo | null;
  savedReplyCount: number;
  snapshotCount: number;
}

export interface TrendingItem {
  rank: number;
  score: number;
  post: PostCard;
}

export interface ActiveUser {
  id: number;
  name: string;
  color: string;
  badge: string | null;
  ccfLevel: number;
  xcpcLevel: number;
  avatar: string;
  score: number;
}

export interface PostDetail {
  id: number;
  time: string;
  replyCount: number;
  updatedAt?: string;
  snapshots: PostSnapshotInfo[];
  takedown: { reason: string; submitterId: number } | null;
  _count: { replies: number; snapshots: number };
  _replyParticipantCount: number;
  _authorHasReplied?: boolean;
}

export interface PostSnapshotInfo {
  postId: number;
  title: string;
  content: string;
  authorId: number;
  forumSlug: string;
  forum?: ForumInfo | null;
  author?: AuthorInfo | null;
  topped?: boolean;
  locked?: boolean;
  capturedAt: string;
  lastSeenAt: string;
}

export interface ReplyInfo {
  id: number;
  postId?: number;
  authorId: number;
  time: string;
  author: AuthorInfo | null;
  snapshots: { content: string; capturedAt: string; lastSeenAt?: string }[];
  takedown?: { reason: string } | null;
  _count?: { snapshots: number };
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

export interface UserProfile {
  id: string;
  name: string;
  avatarUrl: string;
  nameColor: string;
  badge?: string;
  ccfLevel?: number;
  xcpcLevel?: number;
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
  note?: string;
  snapshot: {
    id: number;
    name: string;
    color: string;
    badge: string | null;
    ccfLevel: number;
    xcpcLevel: number;
  };
}

export interface UserProfileBundle {
  profile: UserProfile;
  usernameHistory: UsernameHistoryEntry[];
  related: never[];
  timeline: TimelineEntry[];
  timelineHasMore: boolean;
  timelineNextCursor: string | null;
}

export interface UserTimelinePage {
  entries: TimelineEntry[];
  hasMore: boolean;
  nextCursor: string | null;
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    const err = new Error(data.error ?? `HTTP ${String(res.status)}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export interface DiscussionFeedEntry {
  kind: "discussion";
  key: string;
  timestamp: string;
  author: AuthorInfo | null;
  postId: number;
  title: string;
  content: string | null;
  forum: ForumInfo;
  replyCount: number;
  recentReplyCount: number;
}

export interface FeedPage {
  seed: string;
  items: DiscussionFeedEntry[];
  hasMore: boolean;
  nextCursor: string | null;
}

export const api = {
  feed: (cursor: string | null, limit = 30) =>
    request<FeedPage>(
      `/api/feed?limit=${String(limit)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  trendingRecent: (limit = 30) =>
    request<{ items: TrendingItem[] }>(`/api/trending/recent?limit=${String(limit)}`),
  trendingExplore: (limit = 30, userLimit = 140) =>
    request<{ items: TrendingItem[]; users: ActiveUser[] }>(
      `/api/trending/explore?limit=${String(limit)}&userLimit=${String(userLimit)}`,
    ),
  discussion: (id: number) => request<PostDetail>(`/api/discussions/${String(id)}`),
  replies: (id: number, take = 50, skip = 0, newest = false) =>
    request<ReplyInfo[]>(
      `/api/discussions/${String(id)}/replies?take=${String(take)}&skip=${String(skip)}${newest ? "&order=newest" : ""}`,
    ),
  timeline: (id: number, take = 10) =>
    request<unknown>(`/api/discussions/${String(id)}/timeline?take=${String(take)}`),
  user: (id: number) => request<UserProfileBundle>(`/api/users/${String(id)}`),
  userTimeline: (id: number, cursor: string | null) =>
    request<UserTimelinePage>(
      `/api/users/${String(id)}/timeline${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),
  crawl: async (id: number) => {
    const res = await fetch(`/api/discussions/${String(id)}/crawl`, {
      method: "POST",
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `HTTP ${String(res.status)}`);
    }
  },
};
