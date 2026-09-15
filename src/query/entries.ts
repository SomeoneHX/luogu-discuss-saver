/**
 * 批量条目解析（对应原项目 packages/query/src/entries.ts）。
 *
 * Markdown 里的链接与 @提及会按 `type:id` 引用外部条目，前端一次性批量请求
 * 这些引用的元数据，用于渲染悬浮预览卡与完整用户外显。
 * 本项目只归档讨论帖，article / paste / problem 一律返回 data: null。
 */

import { desc, inArray } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import { getLuoguAvatar, getPostEntries, type PostDto } from "./discussion.js";

export interface UserEntryDto {
  uid: number;
  name: string;
  badge: string | null;
  color: string;
  ccfLevel: number;
  xcpcLevel: number;
  slogan: string;
  avatar: string;
}

interface EntryMap {
  user: UserEntryDto;
  discuss: PostDto;
  article: never;
  paste: never;
  problem: never;
}

export type EntryRef = {
  [K in keyof EntryMap]: { type: K; id: string };
}[keyof EntryMap];

export type Entry = {
  [K in keyof EntryMap]: { type: K; id: string; data: EntryMap[K] | null };
}[keyof EntryMap];

const KNOWN_TYPES = ["user", "discuss", "article", "paste", "problem"] as const;

export function parseEntryRef(raw: string): EntryRef | null {
  const index = raw.indexOf(":");
  if (index <= 0) return null;
  const type = raw.slice(0, index);
  const id = raw.slice(index + 1);
  if (!id) return null;
  if (!(KNOWN_TYPES as readonly string[]).includes(type)) return null;
  return { type, id } as EntryRef;
}

/** 批量取用户展示资料（每个用户最新一条 UserSnapshot）。 */
export async function getUserEntries(
  db: Db,
  ids: number[],
): Promise<UserEntryDto[]> {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (!unique.length) return [];

  const rows: {
    userId: number;
    name: string;
    badge: string | null;
    color: string;
    ccfLevel: number;
    xcpcLevel: number;
    slogan: string;
  }[] = [];

  // D1 单查询绑定参数上限 100，分批取回后按 capturedAt 取最新
  for (let i = 0; i < unique.length; i += 90) {
    const batch = unique.slice(i, i + 90);
    if (!batch.length) continue;
    const batchRows = await db
      .select({
        userId: schema.UserSnapshot.userId,
        name: schema.UserSnapshot.name,
        badge: schema.UserSnapshot.badge,
        color: schema.UserSnapshot.color,
        ccfLevel: schema.UserSnapshot.ccfLevel,
        xcpcLevel: schema.UserSnapshot.xcpcLevel,
        slogan: schema.UserSnapshot.slogan,
        capturedAt: schema.UserSnapshot.capturedAt,
      })
      .from(schema.UserSnapshot)
      .where(inArray(schema.UserSnapshot.userId, batch))
      .orderBy(desc(schema.UserSnapshot.capturedAt));
    rows.push(...batchRows);
  }

  const latest = new Map<number, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.userId)) latest.set(row.userId, row);
  }

  return [...latest.values()].map((row) => ({
    uid: row.userId,
    name: row.name,
    badge: row.badge,
    color: row.color,
    ccfLevel: row.ccfLevel,
    xcpcLevel: row.xcpcLevel,
    slogan: row.slogan,
    avatar: getLuoguAvatar(row.userId),
  }));
}

export async function resolveEntries(db: Db, refs: EntryRef[]): Promise<Entry[]> {
  const userIds = refs
    .filter((ref) => ref.type === "user")
    .map((ref) => Number(ref.id))
    .filter((id) => Number.isInteger(id));
  const postIds = refs
    .filter((ref) => ref.type === "discuss")
    .map((ref) => Number(ref.id))
    .filter((id) => Number.isInteger(id));

  const [users, posts] = await Promise.all([
    getUserEntries(db, userIds),
    getPostEntries(db, postIds),
  ]);

  const mapping = {
    user: new Map(users.map((user) => [String(user.uid), user] as const)),
    discuss: new Map(posts.map((post) => [String(post.id), post] as const)),
  };

  return refs.map((ref) => {
    const data =
      ref.type === "user" || ref.type === "discuss"
        ? (mapping[ref.type].get(ref.id) ?? null)
        : null;
    return { type: ref.type, id: ref.id, data } as Entry;
  });
}
