-- 自动发现轮的运行记录表（见 src/db/schema.ts 的 DiscoveryRun）
-- 应用方式：wrangler d1 migrations apply luogu-discuss --remote

CREATE TABLE `DiscoveryRun` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `ranAt` integer NOT NULL,
  `scanned` integer NOT NULL,
  `topped` integer NOT NULL,
  `fresh` integer NOT NULL,
  `belowDelta` integer NOT NULL,
  `cooling` integer NOT NULL,
  `enqueued` integer NOT NULL,
  `enqueuedIds` text NOT NULL
);
CREATE INDEX `DiscoveryRun_ranAt_idx` ON `DiscoveryRun` (`ranAt`);
