/**
 * 用户快照保存（D1 版）。
 * 对应原项目 crawler/user.ts，逻辑保持：读上一版快照 → 逐字段比对 →
 * 相同则更新 lastSeenAt，否则插入新快照。
 * 批量实现：2 次读 + 至多 2 次写（原来是每用户 2 次查询的循环）。
 */

import { and, eq, inArray, max, or } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import type { UserColor } from "../db/schema.js";
import type { UserSummary } from "./types.js";
import { deduplicate } from "./utils.js";

type UserSnapshotRow = typeof schema.UserSnapshot.$inferSelect;

async function saveUsers(db: Db, uids: number[]): Promise<void> {
  if (!uids.length) return;
  await db
    .insert(schema.User)
    .values(uids.map((id) => ({ id })))
    .onConflictDoNothing();
}

/** 用户快照的业务字段（不含 capturedAt/lastSeenAt/contentHash 类元数据）。 */
function snapshotFields(u: UserSummary) {
  return {
    name: u.name,
    slogan: u.slogan ?? "",
    badge: u.badge ?? null,
    isAdmin: u.isAdmin,
    isBanned: u.isBanned,
    isRoot: u.isRoot ?? false,
    color: u.color as UserColor,
    ccfLevel: u.ccfLevel,
    xcpcLevel: u.xcpcLevel,
    background: u.background ?? "",
  };
}

function sameSnapshot(a: UserSnapshotRow, b: ReturnType<typeof snapshotFields>): boolean {
  return (
    a.name === b.name &&
    a.slogan === b.slogan &&
    a.badge === b.badge &&
    a.isAdmin === b.isAdmin &&
    a.isBanned === b.isBanned &&
    a.isRoot === b.isRoot &&
    a.color === b.color &&
    a.ccfLevel === b.ccfLevel &&
    a.xcpcLevel === b.xcpcLevel &&
    a.background === b.background
  );
}

export async function saveUserSnapshots(
  db: Db,
  users: UserSummary[],
  now: Date,
): Promise<void> {
  const deduplicated = deduplicate(users, (u) => u.uid);
  if (!deduplicated.length) return;

  await saveUsers(
    db,
    deduplicated.map((u) => u.uid),
  );

  // 1) 每个用户最新快照时间（单次 group by）
  const latestRows = await db
    .select({
      userId: schema.UserSnapshot.userId,
      latest: max(schema.UserSnapshot.capturedAt),
    })
    .from(schema.UserSnapshot)
    .where(
      inArray(
        schema.UserSnapshot.userId,
        deduplicated.map((u) => u.uid),
      ),
    )
    .groupBy(schema.UserSnapshot.userId);
  const latestPairs = latestRows.flatMap((r) =>
    r.latest ? [{ userId: r.userId, capturedAt: r.latest }] : [],
  );

  // 2) 最新快照完整行（按对切分，防绑定参数超限）
  const latestMap = new Map<number, UserSnapshotRow>();
  for (let i = 0; i < latestPairs.length; i += 40) {
    const chunk = latestPairs.slice(i, i + 40);
    const rows = await db
      .select()
      .from(schema.UserSnapshot)
      .where(
        or(
          ...chunk.map((p) =>
            and(
              eq(schema.UserSnapshot.userId, p.userId),
              eq(schema.UserSnapshot.capturedAt, p.capturedAt),
            ),
          ),
        ),
      );
    for (const row of rows) latestMap.set(row.userId, row);
  }

  const unchangedPairs: { userId: number; capturedAt: Date }[] = [];
  const toInsert: (typeof schema.UserSnapshot.$inferInsert)[] = [];

  for (const user of deduplicated) {
    const fields = snapshotFields(user);
    const latest = latestMap.get(user.uid);
    if (latest && sameSnapshot(latest, fields)) {
      unchangedPairs.push({
        userId: user.uid,
        capturedAt: latestPairs.find((p) => p.userId === user.uid)!.capturedAt,
      });
      continue;
    }
    toInsert.push({
      userId: user.uid,
      ...fields,
      capturedAt: now,
      lastSeenAt: now,
    });
  }

  // 3) 未变化的批量刷新 lastSeenAt
  for (let i = 0; i < unchangedPairs.length; i += 40) {
    await db
      .update(schema.UserSnapshot)
      .set({ lastSeenAt: now })
      .where(
        or(
          ...unchangedPairs.slice(i, i + 40).map((p) =>
            and(
              eq(schema.UserSnapshot.userId, p.userId),
              eq(schema.UserSnapshot.capturedAt, p.capturedAt),
            ),
          ),
        ),
      );
  }

  // 4) 变化的单次多行插入
  if (toInsert.length) {
    await db.insert(schema.UserSnapshot).values(toInsert).onConflictDoNothing();
  }
}
