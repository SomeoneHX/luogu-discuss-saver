import * as React from "react";
import { ChevronDown, Loader2, MessageCircle, MessageSquare, MessagesSquare } from "lucide-react";

import { Link } from "../App";
import { api, type TimelineEntry, type UserTimelinePage, type UserProfileBundle, type UsernameHistoryEntry } from "../lib/api";
import { cn, formatRelativeTime } from "../lib/utils";
import UserInlineLink from "../components/user-inline-link";
import { UserNotFound } from "../components/error/scene-not-found";

/** 原版 user-info-card.tsx 同款 */
function UserInfoCard({ profile }: { profile: UserProfileBundle["profile"] }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border p-6 text-card-foreground shadow-sm">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border">
          <img src={profile.avatarUrl} alt={profile.name} className="size-full object-cover" />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <h2 className={cn("text-2xl leading-tight font-semibold", `text-luogu-${profile.nameColor}`)}>
              {profile.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="text-sm text-muted-foreground">#{profile.id}</span>
              {profile.ccfLevel ? (
                <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[11px] font-medium">
                  {"CCF\u2009"}
                  {String(profile.ccfLevel)}
                  {"\u2009级"}
                </span>
              ) : null}
              {profile.xcpcLevel ? (
                <span className="rounded-full border border-border/60 px-1.5 py-0.5 text-[11px] font-medium">
                  {"XCPC\u2009"}
                  {String(profile.xcpcLevel)}
                  {"\u2009级"}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{profile.slogan}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-muted/75 p-4 text-sm sm:grid-cols-3">
        {[
          { label: "发帖", value: profile.stats.posts },
          { label: "文章", value: profile.stats.articles },
          { label: "互动", value: profile.stats.interactions },
          { label: "陶片", value: profile.stats.judgements },
          { label: "获赞", value: profile.stats.articleUpvotes },
          { label: "收藏", value: profile.stats.articleFavorites },
        ].map((item) => (
          <div key={item.label}>
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="text-lg font-semibold text-foreground">{String(item.value)}</dd>
          </div>
        ))}
      </dl>
      {profile.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ccfLevelToColor(level: number): string {
  if (level >= 8) return "orange";
  if (level >= 6) return "blue";
  if (level >= 3) return "green";
  return "cheater";
}

function xcpcLevelToColor(level: number): string {
  if (level >= 8) return "orange";
  if (level >= 6) return "blue";
  if (level >= 3) return "green";
  return "cheater";
}

const HISTORY_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDate(date: Date | null) {
  if (!date) return "未知";
  return HISTORY_DATE_FORMATTER.format(date);
}

function getAppearanceKey(snapshot: UsernameHistoryEntry["snapshot"]) {
  const ccfVisual = snapshot.ccfLevel ? ccfLevelToColor(snapshot.ccfLevel) : "none";
  const xcpcVisual = snapshot.xcpcLevel ? xcpcLevelToColor(snapshot.xcpcLevel) : "none";
  return [snapshot.name, snapshot.color, snapshot.badge ?? "", ccfVisual, xcpcVisual].join("|");
}

/** 原版 username-history-card.tsx 同款（折叠 + 外显合并） */
function UsernameHistoryCard({ entries }: { entries: UsernameHistoryEntry[] }) {
  const [open, setOpen] = React.useState(true);

  const collapsed = React.useMemo(() => {
    if (entries.length === 0) return [];
    const ordered = [...entries].sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    );
    const out: { id: string; snapshot: UsernameHistoryEntry["snapshot"]; entries: UsernameHistoryEntry[] }[] = [];
    for (const entry of ordered) {
      const appearanceKey = getAppearanceKey(entry.snapshot);
      const tail = out[out.length - 1];
      if (tail && getAppearanceKey(tail.snapshot) === appearanceKey) {
        tail.entries.push(entry);
        continue;
      }
      out.push({ id: entry.id, snapshot: entry.snapshot, entries: [entry] });
    }
    return out;
  }, [entries]);

  return (
    <section className="rounded-3xl border border-border text-card-foreground shadow-sm">
      <div className="flex items-center justify-between gap-2 px-6 py-4">
        <div>
          <h3 className="text-base font-semibold">历史用户名外显</h3>
          <p className="text-xs text-muted-foreground">追踪最近的用户名外显变动记录。</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
        >
          {open ? "收起" : "展开"}
          <ChevronDown className={cn("size-4 transition-transform", open ? "rotate-180" : "rotate-0")} aria-hidden />
        </button>
      </div>
      <div className={cn("px-6 pb-5", open ? "" : "hidden")}>
        {collapsed.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无外显变动记录</p>
        ) : (
          <ol className="space-y-4">
            {collapsed.map((entry, index) => {
              const current = index === 0;
              const latestChange = entry.entries[0] ? new Date(entry.entries[0].changedAt) : null;
              const earliest = entry.entries[entry.entries.length - 1];
              const earliestDate = earliest ? new Date(earliest.changedAt) : latestChange;
              return (
                <li key={entry.id} className="relative">
                  <UserInlineLink
                    user={{ ...entry.snapshot, avatar: "" }}
                    compact
                    avatar={false}
                    link={false}
                  />
                  <div
                    className={cn(
                      "mt-1 flex flex-wrap gap-x-3 text-[11px] leading-none text-muted-foreground/80",
                      current ? "font-medium text-foreground" : "",
                    )}
                  >
                    <span title={earliestDate?.toISOString()}>最早追溯到 {formatDate(earliestDate)}</span>
                    <span title={latestChange?.toISOString()}>最后捕获于 {formatDate(latestChange)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

const TIMELINE_META = {
  discussion: {
    label: "发起讨论",
    icon: MessagesSquare,
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    dotClass: "bg-violet-500",
  },
  discussionReply: {
    label: "回复讨论",
    icon: MessageSquare,
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
    dotClass: "bg-orange-500",
  },
} as const;

const TIMELINE_DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function renderTimelineContent(entry: TimelineEntry) {
  switch (entry.type) {
    case "discussion":
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
          <Link
            href={entry.href}
            className="text-base font-semibold text-foreground hover:underline"
          >
            {entry.title}
          </Link>
          <p className="mt-2 text-muted-foreground">{entry.summary}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>回复 {String(entry.replies)}</span>
            <span>参与人数 {String(entry.participants)}</span>
          </div>
        </div>
      );
    case "discussionReply":
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm">
          <p className="text-muted-foreground">
            在讨论
            <Link href={entry.href} className="mx-1 font-medium text-foreground hover:underline">
              《{entry.discussionTitle}》
            </Link>
            回复：
          </p>
          <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">
            {entry.excerpt}
          </blockquote>
        </div>
      );
    default:
      return null;
  }
}

/** 原版 user-timeline.tsx 同款（讨论子集） */
function UserTimeline({
  userId,
  initialEntries,
  initialHasMore,
  initialCursor,
}: {
  userId: number;
  initialEntries: TimelineEntry[];
  initialHasMore: boolean;
  initialCursor: string | null;
}) {
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = React.useState<UserTimelinePage[]>([
    { entries: initialEntries, hasMore: initialHasMore, nextCursor: initialCursor },
  ]);
  const [isFetching, setIsFetching] = React.useState(false);
  const [error, setError] = React.useState(false);

  const entries = React.useMemo(() => pages.flatMap((p) => p.entries), [pages]);
  const lastPage = pages[pages.length - 1];
  const hasMore = Boolean(lastPage?.hasMore && lastPage?.nextCursor);

  const fetchNextPage = React.useCallback(async () => {
    if (isFetching || !hasMore) return;
    setIsFetching(true);
    setError(false);
    try {
      const page = await api.userTimeline(userId, lastPage?.nextCursor ?? null);
      setPages((prev) => [...prev, page]);
    } catch {
      setError(true);
    } finally {
      setIsFetching(false);
    }
  }, [isFetching, hasMore, userId, lastPage?.nextCursor]);

  React.useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) void fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasMore]);

  return (
    <section>
      <header className="mb-6">
        <h3 className="text-lg font-semibold">时间线</h3>
        <p className="text-sm text-muted-foreground">最近的讨论与社区记录</p>
      </header>
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center text-sm text-muted-foreground">
          暂无时间线记录
        </div>
      ) : (
        <ol className="space-y-6 pl-4">
          {entries.map((entry) => {
            const meta = TIMELINE_META[entry.type as keyof typeof TIMELINE_META] ?? TIMELINE_META.discussion;
            const createdAt = new Date(entry.createdAt);
            const Icon = meta.icon;
            return (
              <li key={entry.id} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1.5 -left-[15px] inline-flex size-3 items-center justify-center rounded-full border-2 border-card",
                    meta.dotClass,
                  )}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                      meta.badgeClass,
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {meta.label}
                  </span>
                  <time className="text-xs text-muted-foreground" dateTime={entry.createdAt}>
                    {TIMELINE_DATE_FORMATTER.format(createdAt)} · {formatRelativeTime(createdAt)}
                  </time>
                </div>
                <div className="mt-3 space-y-3">{renderTimelineContent(entry)}</div>
              </li>
            );
          })}
        </ol>
      )}
      <div
        ref={sentinelRef}
        className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground"
      >
        {isFetching ? (
          <>
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span>载入更多记录…</span>
          </>
        ) : hasMore ? (
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            className="rounded-full border border-border px-4 py-1.5 text-sm transition hover:bg-muted/60"
          >
            加载更多
          </button>
        ) : entries.length > 0 ? (
          <span>已经到最早的记录</span>
        ) : null}
        {error ? <span className="text-xs text-destructive">加载更多失败</span> : null}
      </div>
    </section>
  );
}

export function UserPage({ id }: { id: number }) {
  const [bundle, setBundle] = React.useState<UserProfileBundle | null>(null);
  const [error, setError] = React.useState("");
  // 「尚未收录」：与原版一致，落到用户未找到页
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    api
      .user(id)
      .then((data) => {
        document.title = `@${data.profile.name} · 洛谷帖子保存站`;
        setBundle(data);
      })
      .catch((e: Error & { status?: number }) => {
        if (e.status === 404 || /not found/i.test(e.message)) setNotFound(true);
        else setError(e.message);
      });
  }, [id]);

  if (notFound) {
    return <UserNotFound />;
  }
  if (error) {
    return <Centered><p className="text-sm text-destructive">加载失败：{error}</p></Centered>;
  }
  if (!bundle) {
    return <Centered><p className="text-sm text-muted-foreground">加载中…</p></Centered>;
  }

  const { profile, usernameHistory, timeline } = bundle;

  return (
    <div className="mx-auto w-full px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3.2fr)_minmax(0,8fr)] lg:items-start xl:grid-cols-[minmax(0,2.7fr)_minmax(0,8fr)]">
        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
          <UserInfoCard profile={profile} />
          <UsernameHistoryCard entries={usernameHistory} />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:self-start">
          <UserTimeline
            userId={id}
            initialEntries={timeline}
            initialHasMore={bundle.timelineHasMore}
            initialCursor={bundle.timelineNextCursor}
          />
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center px-4 py-24">{children}</div>;
}
