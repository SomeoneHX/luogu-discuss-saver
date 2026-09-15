import * as React from "react";
import { api, type ActiveUser, type TrendingItem } from "../lib/api";
import UserInlineLink from "../components/user-inline-link";
import TrendingEntryDiscussion from "../components/trending-entry";
import { cn } from "../lib/utils";

const RANK_COLORS = ["text-yellow-400", "text-gray-400", "text-amber-700"];

/** 探索页右侧「龙王榜」，与原版 active-users.tsx 同款 */
export function ActiveUsers({ users }: { users: ActiveUser[] | null }) {
  return (
    <div>
      <h3 className="text-xl font-bold text-foreground">龙王榜</h3>
      <ol className="mt-4 list-none space-y-4">
        {users?.map((user, index) => (
          <li className="block" key={user.id}>
            <div className="inline-flex w-full items-center justify-center gap-3">
              <span
                className={cn(
                  "w-6 select-none",
                  index < RANK_COLORS.length
                    ? "font-bold " + RANK_COLORS[index]
                    : "text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <span className="flex-1">
                <UserInlineLink
                  user={{ ...user, badge: user.badge || null }}
                  className="align-middle"
                />
              </span>
              <span
                className="font-mono text-sm text-muted-foreground"
                title="活跃指数"
              >
                {user.score.toFixed(3)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RecentPage() {
  const [items, setItems] = React.useState<TrendingItem[] | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    document.title = "最近 · 洛谷帖子保存站";
    api
      .trendingRecent()
      .then((d) => setItems(d.items))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="flex flex-1 justify-center px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,8fr)_minmax(0,1.75fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,8fr)_minmax(0,1.5fr)] 2xl:grid-cols-[minmax(0,3fr)_minmax(0,8fr)_minmax(0,3fr)]">
        <aside className="hidden lg:flex lg:flex-col" />
        <main className="order-1 flex flex-col gap-8 2xl:order-2">
          {error ? <p className="text-sm text-destructive">加载失败：{error}</p> : null}
          {!items && !error ? <SkeletonList /> : null}
          {items && items.length === 0 ? (
            <EmptyState text="暂无最近 7 天的已归档讨论。输入帖子 ID 或访问讨论页即可归档。" />
          ) : null}
          <div className="space-y-5">
            {items?.map((item) => (
              <TrendingEntryDiscussion key={item.post.id} post={item.post} />
            ))}
          </div>
        </main>
        <aside className="order-2 lg:order-2 lg:block 2xl:order-3" />
      </div>
    </div>
  );
}

export function ExplorePage() {
  const [items, setItems] = React.useState<TrendingItem[] | null>(null);
  const [users, setUsers] = React.useState<ActiveUser[] | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    document.title = "探索 · 洛谷帖子保存站";
    api
      .trendingExplore()
      .then((d) => {
        setItems(d.items);
        setUsers(d.users);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="flex flex-1 justify-center px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,3.5fr)] xl:grid-cols-[minmax(0,8fr)_minmax(0,3fr)] 2xl:grid-cols-[minmax(0,3fr)_minmax(0,8fr)_minmax(0,3fr)]">
        <aside className="hidden 2xl:flex 2xl:flex-col" />
        <main className="order-1 flex flex-col gap-8 2xl:order-2">
          {error ? <p className="text-sm text-destructive">加载失败：{error}</p> : null}
          {!items && !error ? <SkeletonList /> : null}
          {items && items.length === 0 ? (
            <EmptyState text="暂无近 15 天有回复的已归档讨论。" />
          ) : null}
          <div className="space-y-5">
            {items?.map((item) => (
              <TrendingEntryDiscussion key={item.post.id} post={item.post} />
            ))}
          </div>
        </main>
        <aside className="order-2 hidden lg:order-2 lg:block 2xl:order-3">
          <ActiveUsers users={users} />
        </aside>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-5">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
