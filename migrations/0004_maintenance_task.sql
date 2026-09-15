-- 运维任务表（见 src/db/schema.ts 的 MaintenanceTask）
-- 应用方式：wrangler d1 migrations apply luogu-discuss --remote
--
-- 用途：把长期维护（如清理「只有维度行、从未落过快照」的帖子）做成
-- Worker 侧的常驻能力。运维侧只写一条 pending 记录作为触发信号，
-- 执行与结果回写都在 Worker 内完成。

CREATE TABLE `MaintenanceTask` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `op` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `requestedAt` integer NOT NULL,
  `startedAt` integer,
  `finishedAt` integer,
  `scanned` integer DEFAULT 0 NOT NULL,
  `deletedPosts` integer DEFAULT 0 NOT NULL,
  `deletedReplies` integer DEFAULT 0 NOT NULL,
  `deletedReplySnapshots` integer DEFAULT 0 NOT NULL,
  `detail` text DEFAULT '' NOT NULL
);
CREATE INDEX `MaintenanceTask_status_idx` ON `MaintenanceTask` (`status`);
