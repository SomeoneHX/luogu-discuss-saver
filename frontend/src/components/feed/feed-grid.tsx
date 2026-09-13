import * as React from "react";
import { Loader2 } from "lucide-react";

import { api, type DiscussionFeedEntry, type FeedPage } from "../../lib/api";

import { FeedCardMasonry } from "./feed-card-masonry";
import DiscussionFeedCard from "./feed-item";

const FETCH_MORE_LIMIT = 20;

export type FeedGridProps = {
  initialPage: FeedPage;
};

export function FeedGrid({ initialPage }: FeedGridProps) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = React.useState<FeedPage[]>([initialPage]);
  const [isFetching, setIsFetching] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(initialPage.hasMore);

  // 首页数据与后续页合并时按 key 去重（原版同款行为）
  const items = React.useMemo<DiscussionFeedEntry[]>(() => {
    const aggregated = pages.flatMap((page) => page.items);
    const unique: DiscussionFeedEntry[] = [];
    const seen = new Set<string>();
    for (const entry of aggregated) {
      if (seen.has(entry.key)) continue;
      seen.add(entry.key);
      unique.push(entry);
    }
    return unique;
  }, [pages]);

  const fetchNextPage = React.useCallback(async () => {
    if (isFetching || !hasMore) return;
    setIsFetching(true);
    setError(false);
    try {
      const lastPage = pages[pages.length - 1];
      const cursor = lastPage?.nextCursor ?? null;
      if (!cursor) {
        setHasMore(false);
        return;
      }
      const page = await api.feed(cursor, FETCH_MORE_LIMIT);
      setPages((prev) => [...prev, page]);
      setHasMore(page.hasMore);
    } catch {
      setError(true);
    } finally {
      setIsFetching(false);
    }
  }, [isFetching, hasMore, pages]);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage]);

  return (
    <div className="flex flex-col gap-6">
      {items.length === 0 && !isFetching ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          暂无可展示的内容——先访问几个帖子让它入库吧。
        </p>
      ) : null}
      <FeedCardMasonry>
        {items.map((item) => (
          <DiscussionFeedCard key={item.key} item={item} />
        ))}
      </FeedCardMasonry>
      <div ref={sentinelRef} className="flex justify-center py-6">
        {isFetching ? (
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        ) : error ? (
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            加载失败，点击重试
          </button>
        ) : hasMore ? (
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            加载更多
          </button>
        ) : null}
      </div>
    </div>
  );
}
