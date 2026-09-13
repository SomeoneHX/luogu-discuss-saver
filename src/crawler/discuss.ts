/**
 * 讨论帖抓取（D1 版）。
 * 对应原项目 crawler/discuss.ts：
 *   - 取数改走 .com.cn + content-only + cookie（见 http.ts）；
 *   - 去掉 pg_advisory_xact_lock / db.transaction，快照写入改为 contentHash 幂等（见 persist.ts）；
 *   - replies.result 兼容数组/对象；
 *   - 维度表（Forum/Problem/User/Post/Reply 行）仍在此处 upsert，保证 FK 满足。
 */

import { count, eq, inArray } from "drizzle-orm";

import { getDb, type Db } from "../db/client.js";
import { schema } from "../db/client.js";
import type { Env } from "../env.js";
import { getLentille } from "./client.js";
import { AccessError, UnexpectedStatusError } from "./errors.js";
import {
  getLatestReplySnapshotAt,
  savePostSnapshot,
  saveReplySnapshots,
  type PostSnapshotInput,
  type ReplySnapshotInput,
} from "./persist.js";
import { saveProblems } from "./problem.js";
import {
  normalizeReplies,
  type ForumSummary,
  type PostDetails,
  type PostSummary,
  type ProblemSummary,
  type ReplySummary,
} from "./types.js";
import { saveUserSnapshots } from "./user.js";
import { deduplicate } from "./utils.js";

export const REPLIES_PER_PAGE = 10;

// ------------------------------ 维度表 upsert ------------------------------

async function saveForums(
  db: Db,
  forums: ForumSummary[],
  now: Date,
): Promise<void> {
  const deduplicated = deduplicate(forums, (f) => f.slug);
  if (!deduplicated.length) return;

  await saveProblems(
    db,
    deduplicated
      .map((f) => f.problem)
      .filter((p): p is ProblemSummary => Boolean(p)),
    now,
  );

  for (const forum of deduplicated) {
    const values = {
      name: forum.name,
      type: forum.type ?? null,
      slug: forum.slug,
      color: forum.color ?? null,
      problemId: forum.problem?.pid ?? null,
      updatedAt: now,
    };
    await db
      .insert(schema.Forum)
      .values(values)
      .onConflictDoUpdate({ target: schema.Forum.slug, set: values });
  }
}

async function savePosts(
  db: Db,
  posts: PostSummary[],
  now: Date,
): Promise<void> {
  const deduplicated = deduplicate(posts, (p) => p.id);
  if (!deduplicated.length) return;

  for (const post of deduplicated) {
    const values = {
      id: post.id,
      time: new Date(post.time * 1000),
      replyCount: post.replyCount,
      updatedAt: now,
    };
    await db
      .insert(schema.Post)
      .values(values)
      .onConflictDoUpdate({
        target: schema.Post.id,
        set: {
          time: values.time,
          replyCount: values.replyCount,
          updatedAt: values.updatedAt,
        },
      });
  }
}

async function saveReplyRows(
  db: Db,
  items: { postId: number; reply: ReplySummary }[],
): Promise<void> {
  const deduplicated = deduplicate(items, (i) => i.reply.id);
  if (!deduplicated.length) return;

  // Reply 行字段不可变（postId/authorId/time 固定），冲突即跳过；
  // 单次多行插入替代逐条 upsert，省 D1 写行数与 subrequest。
  await db
    .insert(schema.Reply)
    .values(
      deduplicated.map(({ postId, reply }) => ({
        id: reply.id,
        postId,
        authorId: reply.author.uid,
        time: new Date(reply.time * 1000),
      })),
    )
    .onConflictDoNothing();
}

// ------------------------------- fetchDiscuss ------------------------------

/**
 * 快照写入统一入口：
 *   - 绑定 POST_LOCKER（后台 Worker）→ Durable Object 严格串行（对齐原版 advisory lock 语义）；
 *   - 否则（Pages 直连）→ contentHash 幂等写入。
 */
async function persistSnapshots(
  env: Env,
  db: Db,
  input: { post: PostSnapshotInput; replies: ReplySnapshotInput[] },
  recentReplyId: number | null,
): Promise<{ numNewReplies: number; recentReplyAt: number | null }> {
  if (env.POST_LOCKER) {
    const stub = env.POST_LOCKER.get(
      env.POST_LOCKER.idFromName(String(input.post.id)),
    );
    await stub.savePost(input.post);
    const numNewReplies = await stub.saveReplies(input.replies);
    const recentReplyAt =
      recentReplyId !== null
        ? await stub.getLatestReplySnapshotAt(recentReplyId)
        : null;
    return { numNewReplies, recentReplyAt };
  }

  await savePostSnapshot(db, input.post);
  const numNewReplies = await saveReplySnapshots(db, input.replies);
  const recentReplyAt =
    recentReplyId !== null
      ? await getLatestReplySnapshotAt(db, recentReplyId)
      : null;
  return { numNewReplies, recentReplyAt };
}

export interface FetchDiscussResult {
  numPages: number;
  numReplies: number;
  numNewReplies: number;
  recentReply: ReplySummary | null;
  recentReplySnapshot: { capturedAt: number } | null;
}

export async function fetchDiscuss(
  env: Env,
  id: number,
  page?: number,
): Promise<FetchDiscussResult> {
  const { status, data, time } = await getLentille(
    "discuss.show",
    { params: { id }, query: page ? { page } : {} },
    env,
  );
  if (status === 403 || status === 404) {
    throw new AccessError(`/discuss/${id}`, status);
  }
  if (status !== 200) {
    throw new UnexpectedStatusError(
      "Unexpected status",
      `/discuss/${id}`,
      status,
    );
  }

  const now = new Date(time * 1000);
  const post = data.post as PostDetails;
  const replies = normalizeReplies(data.replies.result);
  if (post.pinnedReply) replies.push(post.pinnedReply);

  const db = getDb(env);

  // 1) 维度行 upsert（先于快照，满足外键）
  await saveForums(db, [post.forum], now);
  await saveUserSnapshots(
    db,
    replies
      .map((reply) => reply.author)
      .concat(post.author)
      .concat(post.recentReply ? [post.recentReply.author] : []),
    now,
  );
  await savePosts(db, [post], now);
  await saveReplyRows(
    db,
    replies
      .concat(post.recentReply ? [post.recentReply] : [])
      .map((reply) => ({ postId: post.id, reply })),
  );

  // 2) 快照写入：有 POST_LOCKER → DO 严格串行；否则 contentHash 幂等
  const { numNewReplies, recentReplyAt } = await persistSnapshots(
    env,
    db,
    {
      post: {
        id: post.id,
        time,
        replyCount: post.replyCount,
        title: post.title,
        authorId: post.author.uid,
        forumSlug: post.forum.slug,
        topped: post.topped,
        locked: post.locked,
        content: post.content,
        pinnedReplyId: post.pinnedReply?.id ?? null,
      },
      // 快照只对「当前页的 replies」做，recentReply 仅 upsert 行（与原版一致）
      replies: replies.map((reply) => ({
        id: reply.id,
        postId: post.id,
        authorId: reply.author.uid,
        time,
        content: reply.content,
      })),
    },
    post.recentReply?.id ?? null,
  );

  const perPage = data.replies.perPage ?? REPLIES_PER_PAGE;
  const numPages = Math.max(1, Math.ceil(data.replies.count / perPage));

  const recentReplySnapshot =
    recentReplyAt !== null ? { capturedAt: recentReplyAt } : null;

  return {
    numPages,
    numReplies: replies.length,
    numNewReplies,
    recentReply: post.recentReply ?? null,
    recentReplySnapshot,
  };
}

// -------------------------------- listDiscuss ------------------------------

/** 拉取并解析讨论列表（不落库）。落库见 persistDiscussList / listDiscuss。 */
export async function fetchDiscussList(
  env: Env,
  forum: string | null = null,
  page?: number,
): Promise<{ posts: PostSummary[]; time: number }> {
  const { status, data, time } = await getLentille(
    "discuss.list",
    {
      query: { ...(forum ? { forum } : {}), ...(page ? { page } : {}) },
    },
    env,
  );
  if (status !== 200) {
    throw new UnexpectedStatusError("Unexpected status", "/discuss", status);
  }
  return { posts: (data.posts?.result ?? []) as PostSummary[], time };
}

/** 列表元数据落库（Forum/Problem/User/Post/Reply 行 upsert，满足外键）。 */
export async function persistDiscussList(
  env: Env,
  posts: PostSummary[],
  time: number,
): Promise<void> {
  const now = new Date(time * 1000);
  const db = getDb(env);

  await saveForums(
    db,
    posts.map((post) => post.forum),
    now,
  );
  await saveUserSnapshots(
    db,
    posts
      .flatMap((post) => (post.recentReply ? [post, post.recentReply] : [post]))
      .map(({ author }) => author),
    now,
  );
  await savePosts(db, posts, now);
  await saveReplyRows(
    db,
    posts.flatMap(({ id, recentReply }) =>
      recentReply ? [{ postId: id, reply: recentReply }] : [],
    ),
  );
}

export async function listDiscuss(
  env: Env,
  forum: string | null = null,
  page?: number,
): Promise<PostSummary[]> {
  const { posts, time } = await fetchDiscussList(env, forum, page);
  await persistDiscussList(env, posts, time);
  return posts;
}

// ------------------------------ 已归档回复数 ------------------------------

/** 已归档回复行数（按 postId）。 */
export async function getSavedReplyCounts(
  db: Db,
  postIds: number[],
): Promise<Map<number, number>> {
  if (!postIds.length) return new Map();
  const rows = await db
    .select({ postId: schema.Reply.postId, total: count() })
    .from(schema.Reply)
    .where(inArray(schema.Reply.postId, postIds))
    .groupBy(schema.Reply.postId);
  return new Map(rows.map((r) => [r.postId, Number(r.total)]));
}

/** 某帖是否已存在（用于区分新帖）。 */
export async function getExistingPostIds(
  db: Db,
  postIds: number[],
): Promise<Set<number>> {
  if (!postIds.length) return new Set();
  const rows = await db
    .select({ id: schema.Post.id })
    .from(schema.Post)
    .where(inArray(schema.Post.id, postIds));
  return new Set(rows.map((r) => r.id));
}

export { eq };
