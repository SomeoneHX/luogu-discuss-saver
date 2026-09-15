-- DiscoveryRun 增加「每帖判定明细」列（JSON 文本）
ALTER TABLE `DiscoveryRun` ADD COLUMN `detail` text NOT NULL DEFAULT '';
