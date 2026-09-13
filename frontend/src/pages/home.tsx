import * as React from "react";

import { LinkIntake } from "../components/link-intake";
import { FeedGrid } from "../components/feed/feed-grid";
import { api, type FeedPage } from "../lib/api";

const INITIAL_FEED_LIMIT = 30;

export function HomePage() {
  const [initialPage, setInitialPage] = React.useState<FeedPage | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    api
      .feed(null, INITIAL_FEED_LIMIT)
      .then((page) => {
        if (!cancelled) setInitialPage(page);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pt-8 pb-12 sm:px-6">
      <div className="mt-10 mb-4">
        <LinkIntake />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">社区精选</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              实时汇总高热度的讨论帖。
            </p>
          </div>
        </div>
      </div>
      {error ? (
        <p className="py-16 text-center text-sm text-muted-foreground">加载失败，请刷新重试。</p>
      ) : initialPage ? (
        <FeedGrid initialPage={initialPage} />
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
      )}
    </div>
  );
}
