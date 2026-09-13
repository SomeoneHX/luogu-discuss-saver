/** 题目保存（D1 版）。对应原项目 crawler/problem.ts。 */

import { sql } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { schema } from "../db/client.js";
import type { ProblemSummary } from "./types.js";
import { deduplicate } from "./utils.js";

export async function saveProblems(
  db: Db,
  problems: ProblemSummary[],
  now: Date,
): Promise<void> {
  const deduplicated = deduplicate(problems, (p) => p.pid);
  if (!deduplicated.length) return;

  for (const problem of deduplicated) {
    await db
      .insert(schema.Problem)
      .values({
        pid: problem.pid,
        title: problem.title ?? null,
        difficulty: problem.difficulty ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.Problem.pid,
        set: {
          // 列表入口可能不带题面标题；缺省时保留已归档的非空标题，避免被 null 覆盖。
          title: sql`coalesce(excluded."title", ${schema.Problem.title})`,
          difficulty: problem.difficulty ?? null,
          updatedAt: now,
        },
      });
  }
}
