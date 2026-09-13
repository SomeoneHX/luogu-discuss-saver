/**
 * PostLocker：每个 postId 一个 Durable Object，串行化该帖的快照写入。
 *
 * 它替代原项目的 `pg_advisory_xact_lock`：Durable Object 对同一实例天然单线程，
 * 因此「读上一版快照 → 比对 → 相同则更新 lastSeenAt，否则插入新快照」天然互斥。
 *
 * 注意：DO 类必须在 Worker 中定义/部署（Pages 只能绑定引用）。
 * 具体的快照写入逻辑复用 src/crawler/persist.ts，避免与「无 DO 回退」路径重复。
 */

import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";

import {
  getLatestReplySnapshotAt as getLatestReplySnapshotAtDb,
  savePostSnapshot,
  saveReplySnapshots,
  type PostSnapshotInput,
  type ReplySnapshotInput,
} from "../../../src/crawler/persist.js";
import * as schema from "../../../src/db/schema.js";
import type { PostLockerStub } from "../../../src/durable/postLockerInterface.js";
import type { WorkerEnv } from "../env.js";

export class PostLocker
  extends DurableObject<WorkerEnv>
  implements PostLockerStub
{
  private get db() {
    return drizzle(this.env.DB, { schema });
  }

  savePost(payload: PostSnapshotInput): Promise<{ isNew: boolean }> {
    return savePostSnapshot(this.db, payload);
  }

  saveReplies(payloads: ReplySnapshotInput[]): Promise<number> {
    return saveReplySnapshots(this.db, payloads);
  }

  getLatestReplySnapshotAt(replyId: number): Promise<number | null> {
    return getLatestReplySnapshotAtDb(this.db, replyId);
  }

  async fetch(): Promise<Response> {
    return new Response("PostLocker", { status: 200 });
  }
}
