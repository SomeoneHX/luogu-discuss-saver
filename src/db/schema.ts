import { relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// 说明：本文件是原项目 Prisma(PG) 模型在 D1(SQLite) 上的手写等价物。
// 只保留「帖子（讨论）」子系统所需模型：Post / Reply / Forum / User / Problem
// 及其快照与下架记录。文章(Article*)、剪贴板(Paste*)、判决(Judgement*)、动态(Activity*)
// 已按需求剔除。
//
// 类型映射：
//   Int            -> integer
//   DateTime       -> integer({ mode: "timestamp" })  // 存 Unix 秒，读写自动转 Date
//   Boolean        -> integer({ mode: "boolean" })
//   String @db.Text-> text
//   enum Color     -> text({ enum: [...] })
//   复合主键        -> primaryKey({ columns: [...] })
//
// 额外新增列：contentHash —— 用于替代原项目 pg_advisory_xact_lock 的幂等去重
//   （Pages 版不再用 Durable Object：contentHash 直接用于判定「是否变化」并可幂等 upsert）。
// ---------------------------------------------------------------------------

export const USER_COLORS = [
  "Cheater",
  "Gray",
  "Blue",
  "Green",
  "Orange",
  "Red",
  "Purple",
] as const;
export type UserColor = (typeof USER_COLORS)[number];

// ------------------------------- User -------------------------------------

export const User = sqliteTable("User", {
  id: integer("id").primaryKey(),
});

export const UserSnapshot = sqliteTable(
  "UserSnapshot",
  {
    userId: integer("userId").notNull(),
    name: text("name").notNull(),
    slogan: text("slogan").notNull(),
    badge: text("badge"),
    isAdmin: integer("isAdmin", { mode: "boolean" }).notNull(),
    isBanned: integer("isBanned", { mode: "boolean" }).notNull(),
    isRoot: integer("isRoot", { mode: "boolean" }).notNull(),
    color: text("color", { enum: USER_COLORS }).notNull(),
    ccfLevel: integer("ccfLevel").notNull(),
    xcpcLevel: integer("xcpcLevel").notNull(),
    background: text("background").notNull(),
    capturedAt: integer("capturedAt", { mode: "timestamp" }).notNull(),
    lastSeenAt: integer("lastSeenAt", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.capturedAt] }),
    index("UserSnapshot_userId_idx").on(t.userId),
  ],
);

// ------------------------------ Problem -----------------------------------

export const Problem = sqliteTable("Problem", {
  pid: text("pid").primaryKey(),
  // 标题可空：并非所有取数路径都会带回题面标题（列表入口尤其如此），
  // 缺失时保留已归档的值，见 crawler/problem.ts。
  title: text("title"),
  difficulty: integer("difficulty"),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
});

// ------------------------------- Forum ------------------------------------

export const Forum = sqliteTable(
  "Forum",
  {
    slug: text("slug").primaryKey(),
    name: text("name").notNull(),
    type: integer("type"),
    color: text("color"),
    problemId: text("problemId"),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (t) => [uniqueIndex("Forum_problemId_key").on(t.problemId)],
);

// -------------------------------- Post ------------------------------------

export const Post = sqliteTable(
  "Post",
  {
    id: integer("id").primaryKey(),
    time: integer("time", { mode: "timestamp" }).notNull(),
    replyCount: integer("replyCount").notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("Post_time_idx").on(t.time),
    index("Post_replyCount_idx").on(t.replyCount),
  ],
);

export const PostSnapshot = sqliteTable(
  "PostSnapshot",
  {
    postId: integer("postId").notNull(),
    title: text("title").notNull(),
    authorId: integer("authorId").notNull(),
    forumSlug: text("forumSlug").notNull(),
    topped: integer("topped", { mode: "boolean" }).notNull(),
    locked: integer("locked", { mode: "boolean" }).notNull(),
    content: text("content").notNull(),
    pinnedReplyId: integer("pinnedReplyId"),
    capturedAt: integer("capturedAt", { mode: "timestamp" }).notNull(),
    lastSeenAt: integer("lastSeenAt", { mode: "timestamp" }).notNull(),
    contentHash: text("contentHash").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.capturedAt] }),
    index("PostSnapshot_postId_capturedAt_idx").on(t.postId, t.capturedAt),
    index("PostSnapshot_authorId_idx").on(t.authorId),
    index("PostSnapshot_forumSlug_idx").on(t.forumSlug),
  ],
);

export const PostTakedown = sqliteTable("PostTakedown", {
  postId: integer("postId").primaryKey(),
  submitterId: integer("submitterId").notNull(),
  reason: text("reason").notNull(),
});

// ------------------------------- Reply ------------------------------------

export const Reply = sqliteTable(
  "Reply",
  {
    id: integer("id").primaryKey(),
    postId: integer("postId").notNull(),
    authorId: integer("authorId").notNull(),
    time: integer("time", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("Reply_postId_idx").on(t.postId),
    index("Reply_authorId_idx").on(t.authorId),
    index("Reply_time_idx").on(t.time),
  ],
);

export const ReplySnapshot = sqliteTable(
  "ReplySnapshot",
  {
    replyId: integer("replyId").notNull(),
    content: text("content").notNull(),
    capturedAt: integer("capturedAt", { mode: "timestamp" }).notNull(),
    lastSeenAt: integer("lastSeenAt", { mode: "timestamp" }).notNull(),
    contentHash: text("contentHash").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.replyId, t.capturedAt] }),
    index("ReplySnapshot_replyId_capturedAt_idx").on(t.replyId, t.capturedAt),
  ],
);

export const ReplyTakedown = sqliteTable("ReplyTakedown", {
  replyId: integer("replyId").primaryKey(),
  submitterId: integer("submitterId").notNull(),
  reason: text("reason").notNull(),
});

// ------------------------------ Relations ---------------------------------
// 供 query 层 db.query.*.findFirst({ with: {...} }) 使用。

export const userRelations = relations(User, ({ many }) => ({
  snapshots: many(UserSnapshot),
  postSnapshots: many(PostSnapshot),
  replies: many(Reply),
}));

export const userSnapshotRelations = relations(UserSnapshot, ({ one }) => ({
  user: one(User, {
    fields: [UserSnapshot.userId],
    references: [User.id],
  }),
}));

export const problemRelations = relations(Problem, ({ one }) => ({
  forum: one(Forum, {
    fields: [Problem.pid],
    references: [Forum.problemId],
  }),
}));

export const forumRelations = relations(Forum, ({ one, many }) => ({
  problem: one(Problem, {
    fields: [Forum.problemId],
    references: [Problem.pid],
  }),
  postSnapshots: many(PostSnapshot),
}));

export const postRelations = relations(Post, ({ one, many }) => ({
  snapshots: many(PostSnapshot),
  replies: many(Reply),
  takedown: one(PostTakedown, {
    fields: [Post.id],
    references: [PostTakedown.postId],
  }),
}));

export const postSnapshotRelations = relations(PostSnapshot, ({ one }) => ({
  post: one(Post, {
    fields: [PostSnapshot.postId],
    references: [Post.id],
  }),
  author: one(User, {
    fields: [PostSnapshot.authorId],
    references: [User.id],
  }),
  forum: one(Forum, {
    fields: [PostSnapshot.forumSlug],
    references: [Forum.slug],
  }),
  pinnedReply: one(Reply, {
    fields: [PostSnapshot.pinnedReplyId],
    references: [Reply.id],
  }),
}));

export const postTakedownRelations = relations(PostTakedown, ({ one }) => ({
  post: one(Post, {
    fields: [PostTakedown.postId],
    references: [Post.id],
  }),
  submitter: one(User, {
    fields: [PostTakedown.submitterId],
    references: [User.id],
  }),
}));

export const replyRelations = relations(Reply, ({ one, many }) => ({
  post: one(Post, {
    fields: [Reply.postId],
    references: [Post.id],
  }),
  author: one(User, {
    fields: [Reply.authorId],
    references: [User.id],
  }),
  snapshots: many(ReplySnapshot),
  takedown: one(ReplyTakedown, {
    fields: [Reply.id],
    references: [ReplyTakedown.replyId],
  }),
  pinnedTo: many(PostSnapshot),
}));

export const replySnapshotRelations = relations(ReplySnapshot, ({ one }) => ({
  reply: one(Reply, {
    fields: [ReplySnapshot.replyId],
    references: [Reply.id],
  }),
}));

export const replyTakedownRelations = relations(ReplyTakedown, ({ one }) => ({
  reply: one(Reply, {
    fields: [ReplyTakedown.replyId],
    references: [Reply.id],
  }),
  submitter: one(User, {
    fields: [ReplyTakedown.submitterId],
    references: [User.id],
  }),
}));

export type Post = typeof Post.$inferSelect;
export type PostSnapshot = typeof PostSnapshot.$inferSelect;
export type Reply = typeof Reply.$inferSelect;
export type ReplySnapshot = typeof ReplySnapshot.$inferSelect;
export type Forum = typeof Forum.$inferSelect;
export type UserRow = typeof User.$inferSelect;
export type UserSnapshot = typeof UserSnapshot.$inferSelect;
export type Problem = typeof Problem.$inferSelect;
