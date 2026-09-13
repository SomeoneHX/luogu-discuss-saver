/**
 * 帖子读取查询层（D1 版）。
 * 对应原项目 packages/query/src/discussion.ts。
 *
 * 主体使用 drizzle 关系查询 API（db.query.*.findFirst({ with }）与标准函数，
 * 这些在 D1/SQLite 下可直接复用；仅把原版 PG 专有的 `db.$count(...).extras`
 * 改写为显式 count 查询。
 */

import { and, asc, count, countDistinct, desc, eq, gt, inArray, lt, or } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";

export interface ForumDto {
  slug: string;
  name: string;
  problemId: string | null;
  problem?: {
    pid: string;
    title: string | null;
    difficulty: number | null;
  } | null;
}

export interface PostDto {
  id: number;
  title: string;
  content: string;
  time: number;
  replyCount: number;
  forum: ForumDto | null;
  author: {
    id: number;
    name: string;
    avatar: string;
    badge: string | null;
    color: string;
    ccfLevel: number;
    xcpcLevel: number;
  } | null;
  savedReplyCount: number;
  snapshotCount: number;
}

export function getLuoguAvatar(uid: number): string {
  return `https://cdn.luogu.com.cn/upload/usericon/${String(uid)}.png`;
}

export async function getPostWithSnapshot(
  db: Db,
  id: number,
  capturedAt?: Date,
) {
  const post = await db.query.Post.findFirst({
    where: eq(schema.Post.id, id),
    with: {
      snapshots: {
        orderBy: desc(schema.PostSnapshot.capturedAt),
        limit: 1,
        ...(capturedAt
          ? { where: eq(schema.PostSnapshot.capturedAt, capturedAt) }
          : {}),
        with: {
          author: {
            with: {
              snapshots: {
                orderBy: desc(schema.UserSnapshot.capturedAt),
                limit: 1,
              },
            },
          },
          forum: {
            columns: { slug: true, name: true, problemId: true },
            with: {
              problem: {
                columns: { pid: true, title: true, difficulty: true },
              },
            },
          },
        },
      },
      takedown: true,
    },
  });

  if (!post) throw new Error("Post not found");

  const [replyCountRow] = await db
    .select({ total: count() })
    .from(schema.Reply)
    .where(eq(schema.Reply.postId, id));
  const [snapshotCountRow] = await db
    .select({ total: count() })
    .from(schema.PostSnapshot)
    .where(eq(schema.PostSnapshot.postId, id));
  const [participantRow] = await db
    .select({ participants: countDistinct(schema.Reply.authorId) })
    .from(schema.Reply)
    .where(eq(schema.Reply.postId, id));

  const postAuthorId = post.snapshots[0]?.authorId;
  const [authorReplyRow] = postAuthorId
    ? await db
        .select({ total: count() })
        .from(schema.Reply)
        .where(
          and(
            eq(schema.Reply.postId, id),
            eq(schema.Reply.authorId, postAuthorId),
          ),
        )
    : [{ total: 0 }];

  return {
    ...post,
    snapshots: post.snapshots.map((snapshot) => ({
      ...snapshot,
      author: toAuthorDto(snapshot.author),
    })),
    _count: {
      replies: Number(replyCountRow?.total ?? 0),
      snapshots: Number(snapshotCountRow?.total ?? 0),
    },
    _replyParticipantCount: Number(participantRow?.participants ?? 0),
    _authorHasReplied: Number(authorReplyRow?.total ?? 0) > 0,
  };
}

export async function getPostBasicInfo(db: Db, id: number) {
  const [post] = await db
    .select({ id: schema.Post.id })
    .from(schema.Post)
    .where(eq(schema.Post.id, id))
    .limit(1);

  if (!post) throw new Error("Post not found");

  const [replyCountRow] = await db
    .select({ total: count() })
    .from(schema.Reply)
    .where(eq(schema.Reply.postId, id));

  const authors = await db
    .select({ id: schema.PostSnapshot.authorId })
    .from(schema.PostSnapshot)
    .where(eq(schema.PostSnapshot.postId, id))
    .groupBy(schema.PostSnapshot.authorId);

  return {
    id: post.id,
    _count: { replies: Number(replyCountRow?.total ?? 0) },
    authors,
  };
}

export async function getPostRepliesWithLatestSnapshot(
  db: Db,
  postId: number,
  {
    orderBy = "time_asc",
    takeAfterReply,
    take = 10,
    skip = 0,
  }: {
    orderBy: "time_asc" | "time_desc";
    takeAfterReply?: number;
    take: number;
    skip: number;
  } = { orderBy: "time_asc", take: 10, skip: 0 },
) {
  const orderExpressions =
    orderBy === "time_asc"
      ? [asc(schema.Reply.time), asc(schema.Reply.id)]
      : [desc(schema.Reply.time), desc(schema.Reply.id)];

  let whereClause = and(
    eq(schema.Reply.postId, postId),
    // 只返回实际抓到内容快照的回复（避免出现「无快照」空卡）
    inArray(
      schema.Reply.id,
      db.select({ id: schema.ReplySnapshot.replyId }).from(schema.ReplySnapshot),
    ),
  );

  if (takeAfterReply !== undefined) {
    const [cursorRow] = await db
      .select({ id: schema.Reply.id, time: schema.Reply.time })
      .from(schema.Reply)
      .where(eq(schema.Reply.id, takeAfterReply))
      .limit(1);

    if (!cursorRow) return [];

    const comparator =
      orderBy === "time_asc"
        ? or(
            gt(schema.Reply.time, cursorRow.time),
            and(
              eq(schema.Reply.time, cursorRow.time),
              gt(schema.Reply.id, cursorRow.id),
            ),
          )
        : or(
            lt(schema.Reply.time, cursorRow.time),
            and(
              eq(schema.Reply.time, cursorRow.time),
              lt(schema.Reply.id, cursorRow.id),
            ),
          );

    const combined = and(whereClause, comparator);
    if (!combined) return [];
    whereClause = combined;
  }

  const replies = await db.query.Reply.findMany({
    where: whereClause,
    orderBy: orderExpressions,
    offset: skip,
    limit: take,
    with: {
      author: {
        with: {
          snapshots: {
            orderBy: desc(schema.UserSnapshot.capturedAt),
            limit: 1,
          },
        },
      },
      snapshots: {
        orderBy: desc(schema.ReplySnapshot.capturedAt),
        limit: 1,
      },
      takedown: true,
    },
  });

  const replyIds = replies.map((reply) => reply.id);
  // D1 单查询绑定参数上限 100，回复数可能超过，分批统计
  const snapshotCountMap = new Map<number, number>();
  for (let i = 0; i < replyIds.length; i += 90) {
    const chunk = replyIds.slice(i, i + 90);
    const snapshotCounts = await db
      .select({
        replyId: schema.ReplySnapshot.replyId,
        total: count(),
      })
      .from(schema.ReplySnapshot)
      .where(inArray(schema.ReplySnapshot.replyId, chunk))
      .groupBy(schema.ReplySnapshot.replyId);
    for (const row of snapshotCounts) {
      snapshotCountMap.set(row.replyId, Number(row.total));
    }
  }

  return replies.map((reply) => ({
    ...reply,
    author: toAuthorDto(reply.author),
    _count: { snapshots: snapshotCountMap.get(reply.id) ?? 0 },
  }));
}

/** 把带 snapshots 的 User 关系拍平为前端 AuthorDto；无快照时返回 null。 */
function toAuthorDto(
  user:
    | {
        id: number;
        snapshots: {
          name: string;
          color: string;
          badge: string | null;
          ccfLevel: number;
          xcpcLevel: number;
        }[];
      }
    | null
    | undefined,
): {
  id: number;
  name: string;
  avatar: string;
  badge: string | null;
  color: string;
  ccfLevel: number;
  xcpcLevel: number;
} | null {
  const snap = user?.snapshots[0];
  if (!user || !snap) return null;
  return {
    id: user.id,
    name: snap.name,
    avatar: getLuoguAvatar(user.id),
    badge: snap.badge,
    color: snap.color,
    ccfLevel: snap.ccfLevel,
    xcpcLevel: snap.xcpcLevel,
  };
}

export async function getReplyWithLatestSnapshot(db: Db, replyId: number) {
  const reply = await db.query.Reply.findFirst({
    where: eq(schema.Reply.id, replyId),
    with: {
      author: {
        with: {
          snapshots: {
            orderBy: desc(schema.UserSnapshot.capturedAt),
            limit: 1,
          },
        },
      },
      snapshots: {
        orderBy: desc(schema.ReplySnapshot.capturedAt),
        limit: 1,
      },
      takedown: true,
      post: { columns: { id: true } },
    },
  });

  if (!reply) return null;

  const [snapshotCountRow] = await db
    .select({ total: count() })
    .from(schema.ReplySnapshot)
    .where(eq(schema.ReplySnapshot.replyId, replyId));

  return {
    ...reply,
    author: toAuthorDto(reply.author),
    _count: { snapshots: Number(snapshotCountRow?.total ?? 0) },
  };
}

export async function getPostSnapshotsTimeline(
  db: Db,
  postId: number,
  { cursorCapturedAt, take = 10 }: { cursorCapturedAt?: Date; take?: number } = {},
) {
  const snapshots = await db.query.PostSnapshot.findMany({
    where: cursorCapturedAt
      ? and(
          eq(schema.PostSnapshot.postId, postId),
          lt(schema.PostSnapshot.capturedAt, cursorCapturedAt),
        )
      : eq(schema.PostSnapshot.postId, postId),
    orderBy: desc(schema.PostSnapshot.capturedAt),
    limit: take + 1,
    with: {
      forum: {
        columns: { slug: true, name: true, problemId: true },
        with: {
          problem: { columns: { pid: true, title: true, difficulty: true } },
        },
      },
      author: {
        with: {
          snapshots: {
            orderBy: desc(schema.UserSnapshot.capturedAt),
            limit: 1,
          },
        },
      },
    },
  });

  if (snapshots.length === 0) {
    return { items: [], hasMore: false, nextCursor: null as Date | null };
  }

  const hasMore = snapshots.length > take;
  const trimmed = hasMore ? snapshots.slice(0, take) : snapshots;

  type ChangedField = "title" | "content" | "author" | "forum";

  const items = trimmed.map((snapshot, index) => {
    const previous = snapshots[index + 1];
    const changedFields: ChangedField[] = [];

    if (previous) {
      if (snapshot.title !== previous.title) changedFields.push("title");
      if (snapshot.content !== previous.content) changedFields.push("content");
      if (snapshot.authorId !== previous.authorId) {
        changedFields.push("author");
      } else {
        const currentAuthor = snapshot.author.snapshots[0];
        const previousAuthor = previous.author.snapshots[0];
        if (
          currentAuthor?.name !== previousAuthor?.name ||
          currentAuthor?.badge !== previousAuthor?.badge ||
          currentAuthor?.color !== previousAuthor?.color
        ) {
          changedFields.push("author");
        }
      }
      if (snapshot.forumSlug !== previous.forumSlug) changedFields.push("forum");
    }

    const authorSnapshot = snapshot.author.snapshots[0];

    return {
      capturedAt: snapshot.capturedAt,
      lastSeenAt: snapshot.lastSeenAt,
      title: snapshot.title,
      hasPrevious: Boolean(previous),
      author: authorSnapshot
        ? {
            id: snapshot.authorId,
            name: authorSnapshot.name,
            badge: authorSnapshot.badge,
            color: authorSnapshot.color,
            ccfLevel: authorSnapshot.ccfLevel,
            xcpcLevel: authorSnapshot.xcpcLevel,
          }
        : null,
      forum: snapshot.forum as ForumDto,
      changedFields,
    };
  });

  const lastItem = trimmed.length > 0 ? trimmed[trimmed.length - 1] : undefined;

  return {
    items,
    hasMore,
    nextCursor: hasMore && lastItem ? lastItem.capturedAt : null,
  };
}

export async function getPostSnapshotByCapturedAt(
  db: Db,
  postId: number,
  capturedAt: Date,
) {
  const post = await getPostWithSnapshot(db, postId, capturedAt).catch(
    () => null,
  );
  if (!post) return null;
  const snapshot = post.snapshots[0];
  if (!snapshot) return null;
  return { post, snapshot };
}

export async function getPostEntries(
  db: Db,
  ids: number[],
): Promise<PostDto[]> {
  const posts = await db.query.Post.findMany({
    where: inArray(schema.Post.id, ids),
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

  const savedReplyCounts = ids.length
    ? await db
        .select({ postId: schema.Reply.postId, total: count() })
        .from(schema.Reply)
        .where(inArray(schema.Reply.postId, ids))
        .groupBy(schema.Reply.postId)
    : [];
  const savedMap = new Map(
    savedReplyCounts.map((row) => [row.postId, Number(row.total)]),
  );

  const snapshotCounts = ids.length
    ? await db
        .select({ postId: schema.PostSnapshot.postId, total: count() })
        .from(schema.PostSnapshot)
        .where(inArray(schema.PostSnapshot.postId, ids))
        .groupBy(schema.PostSnapshot.postId)
    : [];
  const snapshotMap = new Map(
    snapshotCounts.map((row) => [row.postId, Number(row.total)]),
  );

  return posts.flatMap((post) =>
    post.snapshots.flatMap((snapshot) =>
      snapshot.author.snapshots.map((authorSnapshot) => ({
        id: post.id,
        title: snapshot.title,
        content: snapshot.content,
        time: Math.floor(post.time.getTime() / 1000),
        forum: snapshot.forum as ForumDto,
        replyCount: post.replyCount,
        author: {
          id: authorSnapshot.userId,
          name: authorSnapshot.name,
          badge: authorSnapshot.badge,
          color: authorSnapshot.color,
          ccfLevel: authorSnapshot.ccfLevel,
          xcpcLevel: authorSnapshot.xcpcLevel,
          avatar: getLuoguAvatar(authorSnapshot.userId),
        },
        savedReplyCount: savedMap.get(post.id) ?? 0,
        snapshotCount: snapshotMap.get(post.id) ?? 0,
      })),
    ),
  );
}
