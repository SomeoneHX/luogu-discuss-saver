-- luogu-discuss-saver 初始 schema（仅帖子/讨论子系统）
-- 由 src/db/schema.ts 的 Drizzle SQLite 定义对应生成。
-- 应用方式：wrangler d1 migrations apply luogu-discuss --local|--remote

CREATE TABLE `User` (
  `id` integer PRIMARY KEY NOT NULL
);

CREATE TABLE `UserSnapshot` (
  `userId` integer NOT NULL,
  `name` text NOT NULL,
  `slogan` text NOT NULL,
  `badge` text,
  `isAdmin` integer NOT NULL,
  `isBanned` integer NOT NULL,
  `isRoot` integer NOT NULL,
  `color` text NOT NULL,
  `ccfLevel` integer NOT NULL,
  `xcpcLevel` integer NOT NULL,
  `background` text NOT NULL,
  `capturedAt` integer NOT NULL,
  `lastSeenAt` integer NOT NULL,
  PRIMARY KEY (`userId`, `capturedAt`),
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
);
CREATE INDEX `UserSnapshot_userId_idx` ON `UserSnapshot` (`userId`);

CREATE TABLE `Problem` (
  `pid` text PRIMARY KEY NOT NULL,
  `title` text,
  `difficulty` integer,
  `updatedAt` integer NOT NULL
);

CREATE TABLE `Forum` (
  `slug` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `type` integer,
  `color` text,
  `problemId` text,
  `updatedAt` integer NOT NULL,
  FOREIGN KEY (`problemId`) REFERENCES `Problem`(`pid`)
);
CREATE UNIQUE INDEX `Forum_problemId_key` ON `Forum` (`problemId`);

CREATE TABLE `Post` (
  `id` integer PRIMARY KEY NOT NULL,
  `time` integer NOT NULL,
  `replyCount` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
CREATE INDEX `Post_time_idx` ON `Post` (`time`);
CREATE INDEX `Post_replyCount_idx` ON `Post` (`replyCount`);

CREATE TABLE `Reply` (
  `id` integer PRIMARY KEY NOT NULL,
  `postId` integer NOT NULL,
  `authorId` integer NOT NULL,
  `time` integer NOT NULL,
  FOREIGN KEY (`postId`) REFERENCES `Post`(`id`),
  FOREIGN KEY (`authorId`) REFERENCES `User`(`id`)
);
CREATE INDEX `Reply_postId_idx` ON `Reply` (`postId`);
CREATE INDEX `Reply_authorId_idx` ON `Reply` (`authorId`);
CREATE INDEX `Reply_time_idx` ON `Reply` (`time`);

CREATE TABLE `ReplySnapshot` (
  `replyId` integer NOT NULL,
  `content` text NOT NULL,
  `capturedAt` integer NOT NULL,
  `lastSeenAt` integer NOT NULL,
  `contentHash` text NOT NULL,
  PRIMARY KEY (`replyId`, `capturedAt`),
  FOREIGN KEY (`replyId`) REFERENCES `Reply`(`id`)
);
CREATE INDEX `ReplySnapshot_replyId_capturedAt_idx` ON `ReplySnapshot` (`replyId`, `capturedAt`);

CREATE TABLE `ReplyTakedown` (
  `replyId` integer PRIMARY KEY NOT NULL,
  `submitterId` integer NOT NULL,
  `reason` text NOT NULL,
  FOREIGN KEY (`replyId`) REFERENCES `Reply`(`id`),
  FOREIGN KEY (`submitterId`) REFERENCES `User`(`id`)
);

CREATE TABLE `PostSnapshot` (
  `postId` integer NOT NULL,
  `title` text NOT NULL,
  `authorId` integer NOT NULL,
  `forumSlug` text NOT NULL,
  `topped` integer NOT NULL,
  `locked` integer NOT NULL,
  `content` text NOT NULL,
  `pinnedReplyId` integer,
  `capturedAt` integer NOT NULL,
  `lastSeenAt` integer NOT NULL,
  `contentHash` text NOT NULL,
  PRIMARY KEY (`postId`, `capturedAt`),
  FOREIGN KEY (`postId`) REFERENCES `Post`(`id`),
  FOREIGN KEY (`authorId`) REFERENCES `User`(`id`),
  FOREIGN KEY (`forumSlug`) REFERENCES `Forum`(`slug`),
  FOREIGN KEY (`pinnedReplyId`) REFERENCES `Reply`(`id`)
);
CREATE INDEX `PostSnapshot_postId_capturedAt_idx` ON `PostSnapshot` (`postId`, `capturedAt`);
CREATE INDEX `PostSnapshot_authorId_idx` ON `PostSnapshot` (`authorId`);
CREATE INDEX `PostSnapshot_forumSlug_idx` ON `PostSnapshot` (`forumSlug`);

CREATE TABLE `PostTakedown` (
  `postId` integer PRIMARY KEY NOT NULL,
  `submitterId` integer NOT NULL,
  `reason` text NOT NULL,
  FOREIGN KEY (`postId`) REFERENCES `Post`(`id`),
  FOREIGN KEY (`submitterId`) REFERENCES `User`(`id`)
);
