/**
 * 用户快照保存（D1 版）。
 * 对应原项目 crawler/user.ts，逻辑保持：读上一版快照 → 逐字段比对 →
 * 相同则更新 lastSeenAt，否则插入新快照。
 */

import { and, desc, eq } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import type { UserColor } from "../db/schema.js";
import type { UserSummary } from "./types.js";
import { deduplicate } from "./utils.js";

async function saveUsers(db: Db, uids: number[]): Promise<void> {
  if (!uids.length) return;
  await db
    .insert(schema.User)
    .values(uids.map((id) => ({ id })))
    .onConflictDoNothing();
}

async function saveUserSnapshot(
  db: Db,
  user: UserSummary,
  now: Date,
): Promise<void> {
  const name = user.name;
  const slogan = user.slogan ?? "";
  const badge = user.badge ?? null;
  const isAdmin = user.isAdmin;
  const isBanned = user.isBanned;
  const isRoot = user.isRoot ?? false;
  const color = user.color as UserColor;
  const ccfLevel = user.ccfLevel;
  const xcpcLevel = user.xcpcLevel;
  const background = user.background ?? "";

  const [latest] = await db
    .select()
    .from(schema.UserSnapshot)
    .where(eq(schema.UserSnapshot.userId, user.uid))
    .orderBy(desc(schema.UserSnapshot.capturedAt))
    .limit(1);

  if (
    latest &&
    latest.name === name &&
    latest.slogan === slogan &&
    latest.badge === badge &&
    latest.isAdmin === isAdmin &&
    latest.isBanned === isBanned &&
    latest.isRoot === isRoot &&
    latest.color === color &&
    latest.ccfLevel === ccfLevel &&
    latest.xcpcLevel === xcpcLevel &&
    latest.background === background
  ) {
    await db
      .update(schema.UserSnapshot)
      .set({ lastSeenAt: now })
      .where(
        and(
          eq(schema.UserSnapshot.userId, user.uid),
          eq(schema.UserSnapshot.capturedAt, latest.capturedAt),
        ),
      );
    return;
  }

  await db
    .insert(schema.UserSnapshot)
    .values({
      userId: user.uid,
      name,
      slogan,
      badge,
      isAdmin,
      isBanned,
      isRoot,
      color,
      ccfLevel,
      xcpcLevel,
      background,
      capturedAt: now,
      lastSeenAt: now,
    })
    .onConflictDoNothing();
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
  for (const user of deduplicated) {
    await saveUserSnapshot(db, user, now);
  }
}
