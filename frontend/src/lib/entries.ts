import * as React from "react";

import type { AuthorInfo, ForumInfo } from "./api";

/**
 * 条目元数据批量加载（对应原版 magic-link/entry-loader.ts + react-query 的组合）。
 *
 * 原版用 dataloader 在同一事件循环内攒批 + @tanstack/react-query 做跨组件缓存；
 * 这里用「微任务攒批 + 模块级 Map 缓存 + 订阅」实现等价语义，不引第三方状态库。
 */

export type EntryRef = {
  type: "user" | "discuss" | "article" | "paste" | "problem";
  id: string;
};

export interface UserEntry {
  uid: number;
  name: string;
  badge: string | null;
  color: string;
  ccfLevel: number;
  xcpcLevel: number;
  slogan: string;
  avatar: string;
}

export interface DiscussEntry {
  id: number;
  title: string;
  content: string;
  time: number;
  replyCount: number;
  forum: ForumInfo | null;
  author: AuthorInfo | null;
  savedReplyCount: number;
  snapshotCount: number;
}

export type Entry =
  | (EntryRef & { type: "user"; data: UserEntry | null })
  | (EntryRef & { type: "discuss"; data: DiscussEntry | null })
  | (EntryRef & { data: null });

const cache = new Map<string, Entry | null>();
const inflight = new Map<string, Promise<Entry | null>>();
const listeners = new Map<string, Set<() => void>>();

let pendingRefs: EntryRef[] = [];
let flushScheduled = false;

function keyOf(ref: EntryRef): string {
  return `${ref.type}:${ref.id}`;
}

function notify(key: string): void {
  listeners.get(key)?.forEach((listener) => listener());
}

async function flush(): Promise<void> {
  flushScheduled = false;
  const refs = pendingRefs;
  pendingRefs = [];
  if (!refs.length) return;

  const unique = new Map<string, EntryRef>();
  for (const ref of refs) unique.set(keyOf(ref), ref);

  const params = new URLSearchParams();
  for (const ref of unique.values()) {
    params.append("entry-ref", `${ref.type}:${ref.id}`);
  }

  try {
    const res = await fetch(`/api/entries?${params.toString()}`);
    const entries = res.ok ? ((await res.json()) as Entry[]) : [];
    const byKey = new Map(entries.map((entry) => [keyOf(entry), entry]));
    for (const [key, ref] of unique) {
      const entry = byKey.get(key) ?? { ...ref, data: null };
      cache.set(key, entry);
      notify(key);
    }
  } catch {
    for (const key of unique.keys()) {
      cache.set(key, null);
      notify(key);
    }
  }
}

/** 与原版 entryLoader.load(ref) 等价：同一事件循环内的调用合并为一次请求。 */
export function loadEntry(ref: EntryRef): Promise<Entry | null> {
  const key = keyOf(ref);
  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);

  const existing = inflight.get(key);
  if (existing) return existing;

  pendingRefs.push(ref);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(() => {
      void flush();
    });
  }

  // 攒批完成后由缓存取值；这里返回一个等缓存就绪的 promise
  const promise = new Promise<Entry | null>((resolve) => {
    const stop = () => {
      const value = cache.get(key);
      if (value !== undefined) {
        off();
        resolve(value);
      }
    };
    const off = subscribe(key, stop);
    // 若本批请求已结束（cache 已有值），立即结算
    stop();
  }).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

function subscribe(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}

/** 与原版 useQuery({ queryKey: [type, id], queryFn }) 等价的读取 hook。 */
export function useEntry<T extends Entry>(ref: T["type"] | null, id?: string): T | null {
  const key = ref && id ? `${ref}:${id}` : null;

  const [entry, setEntry] = React.useState<Entry | null>(() =>
    key ? (cache.get(key) ?? null) : null,
  );

  React.useEffect(() => {
    if (!key || !ref || !id) {
      setEntry(null);
      return;
    }
    const cached = cache.get(key);
    setEntry(cached ?? null);
    if (cached !== undefined) return;

    let cancelled = false;
    const off = subscribe(key, () => {
      if (!cancelled) setEntry(cache.get(key) ?? null);
    });
    void loadEntry({ type: ref as EntryRef["type"], id });
    return () => {
      cancelled = true;
      off();
    };
  }, [key, ref, id]);

  return entry as T | null;
}
