/**
 * PostLocker 的**结构化接口**（跨运行时共用）。
 *
 * 实现位于后台 Worker（worker/src/durable/postLocker.ts）——因为
 * Durable Object 类必须在 Worker 中定义/部署，Pages 只能通过绑定引用。
 *
 * 这里刻意不写成 `DurableObjectNamespace<T>`：Cloudflare 对 Durable Object 采用名义类型
 * （`T` 必须 extends `Rpc.DurableObjectBranded`，且 `DurableObjectStub<T>` 仅在 `T` 带品牌时
 * 才暴露 RPC 方法）。共享层若引用它，就必须依赖 Worker 侧的具体 DO 类，破坏分层。
 * 因此只描述「绑定的最小形状」，DO 绑定天然满足；共用逻辑（src/crawler/*）只依赖本文件，
 * 在「有 DO」时严格串行、「无 DO」时回退 contentHash 幂等。
 */

import type { PostSnapshotInput, ReplySnapshotInput } from "../crawler/persist.js";

export interface SavePostResult {
  isNew: boolean;
}

/** DO 实例对调用方暴露的方法（与 worker/src/durable/postLocker.ts 的公开方法一致）。 */
export interface PostLockerStub {
  /** 保存帖子快照：内容有变则插入新版本，否则只刷新 lastSeenAt。 */
  savePost(payload: PostSnapshotInput): Promise<SavePostResult>;
  /** 保存一组回复快照，返回新增（内容有变化）的数量。 */
  saveReplies(payloads: ReplySnapshotInput[]): Promise<number>;
  /** 某回复最新快照的 capturedAt（Unix 秒），无则 null。 */
  getLatestReplySnapshotAt(replyId: number): Promise<number | null>;
}

/** DO 绑定的最小形状（`DurableObjectNamespace` 满足此结构）。 */
export interface PostLockerBinding {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): PostLockerStub;
}
