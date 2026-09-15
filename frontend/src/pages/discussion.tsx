import * as React from "react";
import {
  Calendar,
  ClipboardCheck,
  ClipboardCopy,
  Camera,
  History,
  MessageCircle,
  RefreshCcw,
  Reply,
  SquareArrowOutUpRight,
  SquareCheckBig,
  Tag,
  Users,
} from "lucide-react";

import { Link } from "../App";
import { api, type PostDetail, type PostSnapshotInfo, type ReplyInfo } from "../lib/api";
import { ABSOLUTE_DATE_FORMATTER, cn, formatRelativeTime } from "../lib/utils";
import Markdown from "../components/markdown";
import CommentCard, { useClipboard } from "../components/comment-card";
import { MetaItem } from "../components/meta-item";
import UserInlineLink from "../components/user-inline-link";
import { ForumDisplay, ForumDisplayShort } from "../components/forum-display";

const PAGE_SIZE = 15;

/** 原版 meta-row.tsx 同款 */
function DiscussionMetaRow({
  discussion,
  compact = false,
}: {
  discussion: {
    time: Date;
    forum: Exclude<PostSnapshotInfo["forum"], undefined> | null;
    author: Exclude<PostSnapshotInfo["author"], undefined> | null;
    allRepliesCount: number;
    allParticipantsCount: number;
  };
  compact?: boolean;
}) {
  const publishedAt = ABSOLUTE_DATE_FORMATTER.format(discussion.time);

  const metaItems = (
    <>
      <MetaItem icon={Calendar} compact={compact}>
        <time dateTime={discussion.time.toISOString()}>{publishedAt}</time>
      </MetaItem>
      <MetaItem icon={Tag} compact={compact}>
        {compact ? (
          <ForumDisplayShort forum={discussion.forum} />
        ) : (
          <ForumDisplay forum={discussion.forum} />
        )}
      </MetaItem>
      <MetaItem icon={Users} compact={compact}>
        {"参与者\u2009"}
        {discussion.allParticipantsCount.toLocaleString("zh-CN")}
      </MetaItem>
      <MetaItem icon={MessageCircle} compact={compact}>
        {"已保存回复\u2009"}
        {discussion.allRepliesCount.toLocaleString("zh-CN")}
      </MetaItem>
    </>
  );

  const baseClass = "flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-sm";

  return (
    <div className={cn(baseClass, !compact && "w-full")}>
      {compact ? (
        <>
          {discussion.author ? <UserInlineLink user={discussion.author} /> : null}
          {metaItems}
        </>
      ) : (
        <>
          <div className="shrink-0">
            {discussion.author ? <UserInlineLink user={discussion.author} /> : null}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-right">
            {metaItems}
          </div>
        </>
      )}
    </div>
  );
}

/** 原版 operation-panel.tsx 同款（时光机改为内嵌快照抽屉） */
function OperationPanel({
  post,
  snap,
  onRefresh,
  refreshing,
  onOpenWayback,
}: {
  post: PostDetail;
  snap: PostSnapshotInfo | undefined;
  onRefresh: () => void;
  refreshing: boolean;
  onOpenWayback: () => void;
}) {
  const [copiedLink, copyLink] = useClipboard();
  const [copiedSnapshotLink, copySnapshotLink] = useClipboard();
  const [copiedTopicMarkdown, copyTopicMarkdown] = useClipboard();

  const snapshotToken = snap ? new Date(snap.capturedAt).getTime().toString(36) : "";
  const originalLink = `https://www.luogu.com.cn/discuss/${String(post.id)}`;
  const archiveLink = `https://lglg.pages.dev/d/${String(post.id)}`;
  const archiveSnapshotLink = `https://lglg.pages.dev/d/${String(post.id)}@${snapshotToken}`;
  const topicMarkdown = snap?.content ?? "";

  return (
    <div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">讨论操作</h2>
        <p className="text-sm text-muted-foreground">
          快速查看讨论及其快照的属性，并进行相关操作。
        </p>
      </div>

      <dl className="mt-6 space-y-3 text-sm text-foreground">
        <StatRow
          label="洛谷回复数"
          value={`${post.replyCount.toLocaleString("zh-CN")}\u2009条`}
        />
        <StatRow
          label="已归档回复"
          value={`${post._count.replies.toLocaleString("zh-CN")}\u2009条`}
        />
        <StatRow
          label="当前快照"
          value={`${post.snapshots.length.toLocaleString("zh-CN")}\u2009份`}
        />
        <StatRow label="快照标识符" value={`@${snapshotToken}`} />
        {snap ? (
          <>
            <StatRow
              label="此快照首次捕获于"
              value={ABSOLUTE_DATE_FORMATTER.format(new Date(snap.capturedAt))}
              hint={formatRelativeTime(new Date(snap.capturedAt))}
            />
            <StatRow
              label="此快照最后确认于"
              value={ABSOLUTE_DATE_FORMATTER.format(new Date(snap.lastSeenAt))}
              hint={formatRelativeTime(new Date(snap.lastSeenAt))}
            />
          </>
        ) : null}
      </dl>

      <div className="mt-6 grid gap-2">
        <a
          href={originalLink}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center justify-start gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Reply className="size-4" aria-hidden /> 查看原帖
        </a>
        <button
          type="button"
          onClick={onOpenWayback}
          className="inline-flex items-center justify-start gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60"
        >
          <History className="size-4" aria-hidden /> 时光机
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-start gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60 disabled:opacity-60"
        >
          <RefreshCcw className={cn("size-4", refreshing && "animate-spin")} aria-hidden />
          更新帖子
        </button>
        <button
          type="button"
          onClick={() => copyLink(archiveLink)}
          aria-live="polite"
          className="inline-flex items-center justify-start gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60"
        >
          {copiedLink ? (
            <SquareCheckBig className="size-4" aria-hidden />
          ) : (
            <SquareArrowOutUpRight className="size-4" aria-hidden />
          )}
          复制链接
        </button>
        <button
          type="button"
          onClick={() => copySnapshotLink(archiveSnapshotLink)}
          aria-live="polite"
          className="inline-flex items-center justify-start gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60"
        >
          {copiedSnapshotLink ? (
            <SquareCheckBig className="size-4" aria-hidden />
          ) : (
            <SquareArrowOutUpRight className="size-4" aria-hidden />
          )}
          复制快照链接
        </button>
        <button
          type="button"
          onClick={() => copyTopicMarkdown(topicMarkdown)}
          aria-live="polite"
          className="inline-flex items-center justify-start gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60"
        >
          {copiedTopicMarkdown ? (
            <ClipboardCheck className="size-4" aria-hidden />
          ) : (
            <ClipboardCopy className="size-4" aria-hidden />
          )}
          复制零楼 Markdown
        </button>
      </div>
    </div>
  );
}

function StatRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
      {hint ? <span className="text-xs text-muted-foreground/70">{hint}</span> : null}
    </div>
  );
}

export function DiscussionPage({
  id,
  snapshotToken,
}: {
  id: number;
  snapshotToken?: string;
}) {
  const [post, setPost] = React.useState<PostDetail | null>(null);
  const [replies, setReplies] = React.useState<ReplyInfo[]>([]);
  const [hasMoreReplies, setHasMoreReplies] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [replySort, setReplySort] = React.useState<"oldest" | "newest">("oldest");
  const [error, setError] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);
  const [waybackOpen, setWaybackOpen] = React.useState(false);
  const [isMetaPinned, setIsMetaPinned] = React.useState(false);

  const load = React.useCallback(async () => {
    setError("");
    try {
      const detail = await api.discussion(id);
      document.title = `${detail.snapshots[0]?.title ?? `#${String(id)}`} · 洛谷帖子保存站`;
      setPost(detail);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 404 || /not found/i.test(e.message)) {
        setPost(null);
        await crawlAndWait(id, setError, setRefreshing);
      } else {
        setError(e.message);
      }
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    let cancelled = false;
    const fetchReplies = async (): Promise<void> => {
      try {
        // 翻页加载：首屏只取一页，控制 D1 行读取
        const r = await api.replies(id, PAGE_SIZE, 0, replySort === "newest");
        if (cancelled) return;
        setReplies(r);
        setHasMoreReplies(r.length === PAGE_SIZE);
      } catch {
        /* 保留空态 */
      }
    };
    void fetchReplies();
    return () => {
      cancelled = true;
    };
  }, [id, replySort]);

  const loadMoreReplies = React.useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api.replies(id, PAGE_SIZE, replies.length, replySort === "newest");
      setReplies((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...r.filter((x) => !seen.has(x.id))];
      });
      setHasMoreReplies(r.length === PAGE_SIZE);
    } catch {
      /* 保持现状 */
    } finally {
      setLoadingMore(false);
    }
  }, [id, replies.length, replySort, loadingMore]);

  // 滚动到底部自动续载下一页
  React.useEffect(() => {
    if (!hasMoreReplies || replies.length === 0) return;
    const sentinel = document.getElementById("replies-sentinel");
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMoreReplies();
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreReplies, replies.length, loadMoreReplies]);

  // 原版 layout 的 meta 悬浮判定
  React.useEffect(() => {
    const TOP_OFFSET = 50;
    let animationFrame = 0;
    const runCheck = () => {
      animationFrame = 0;
      const target = document.getElementById("discussion-meta-row");
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const isVisible = rect.top >= TOP_OFFSET && rect.top < viewportHeight;
      setIsMetaPinned(!isVisible);
    };
    const scheduleCheck = () => {
      if (animationFrame !== 0) return;
      animationFrame = window.requestAnimationFrame(runCheck);
    };
    window.addEventListener("scroll", scheduleCheck, { passive: true });
    window.addEventListener("resize", scheduleCheck);
    runCheck();
    return () => {
      window.removeEventListener("scroll", scheduleCheck);
      if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
    };
  }, [post]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await api.crawl(id);
      await new Promise((r) => setTimeout(r, 4000));
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  if (error && !post) {
    return (
      <Centered>
        <p className="text-sm text-destructive">{error}</p>
      </Centered>
    );
  }
  if (!post) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">
          {refreshing
            ? "该帖尚未归档，已加入抓取队列，正在等待（通常需 1~3 分钟）…"
            : "加载中…"}
        </p>
      </Centered>
    );
  }

  // 快照选择：URL 带 @token 时定位到该快照，否则最新
  let snap = post.snapshots[0];
  if (snapshotToken) {
    const ts = Number.parseInt(snapshotToken, 36);
    const found = post.snapshots.find(
      (s) => Math.abs(new Date(s.capturedAt).getTime() - ts) < 1500,
    );
    if (found) snap = found;
  }
  const isLatest = snap === post.snapshots[0];
  const authorIds = new Set(post.snapshots.map((s) => s.authorId));

  const metaRow = (
    <DiscussionMetaRow
      discussion={{
        time: new Date(post.time),
        forum: snap?.forum ?? null,
        author: snap?.author ?? null,
        allRepliesCount: post._count.replies,
        allParticipantsCount: post._replyParticipantCount ?? 0,
      }}
    />
  );

  return (
    <div className="flex flex-1 justify-center px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <div className="relative w-full">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,3.2fr)] xl:grid-cols-[minmax(0,8fr)_minmax(0,2.7fr)]">
          <main className="order-1 flex flex-col gap-8">
            <section className="flex flex-col gap-6">
              <header className="space-y-4">
                {post.takedown ? (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                    已被下架：{post.takedown.reason}
                  </div>
                ) : null}
                <p className="text-sm font-medium text-muted-foreground">社区讨论</p>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {snap?.title ?? `帖子 #${String(post.id)}`}
                </h1>
                <div id="discussion-meta-row">{metaRow}</div>
              </header>

              <div className="lg:hidden">
                {snap ? (
                  <OperationPanel
                    post={post}
                    snap={snap}
                    onRefresh={() => void handleRefresh()}
                    refreshing={refreshing}
                    onOpenWayback={() => setWaybackOpen(true)}
                  />
                ) : null}
              </div>

              <section className="space-y-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
                <Markdown>{snap?.content || "（无内容）"}</Markdown>
              </section>
            </section>

            <section className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  回复（{post.replyCount.toLocaleString("zh-CN")}）
                </h2>
                <div className="flex items-center gap-1 rounded-full border border-border p-1 text-xs">
                  {(["oldest", "newest"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReplySort(s)}
                      className={cn(
                        "rounded-full px-3 py-1 transition",
                        replySort === s
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {s === "oldest" ? "最旧" : "最新"}
                    </button>
                  ))}
                </div>
              </div>
              {replies.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center text-sm text-muted-foreground">
                  暂无已归档回复。
                </div>
              ) : (
                <ol className="space-y-6">
                  {replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentCard
                        reply={reply}
                        isFromDiscussionAuthor={authorIds.has(reply.authorId)}
                        mentionContext={{
                          kind: "discussion",
                          discussionId: id,
                          relativeReplyId: reply.id,
                          discussionAuthors: [...authorIds],
                        }}
                      />
                    </li>
                  ))}
                </ol>
              )}
              {replies.length > 0 ? (
                <div id="replies-sentinel" className="flex justify-center pt-2">
                  {hasMoreReplies ? (
                    <span className="text-sm text-muted-foreground">
                      {loadingMore ? "正在加载更多回复…" : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/70">
                      已加载全部 {replies.length.toLocaleString("zh-CN")} 条回复
                    </span>
                  )}
                </div>
              ) : null}
            </section>
          </main>

          <aside className="order-2 hidden lg:block">
            <div className="sticky top-24.25 flex flex-col gap-4">
              <div
                className="grid transition-[grid-template-rows,gap] duration-300 ease-out"
                style={{
                  gridTemplateRows: `${isMetaPinned ? "auto" : "0px"}`,
                  gap: isMetaPinned ? "14px" : "0px",
                }}
              >
                <div
                  className={cn(
                    "relative h-full overflow-hidden transition-opacity duration-300 ease-out",
                    isMetaPinned ? "opacity-100" : "opacity-0",
                  )}
                >
                  <div className="h-full pb-2.5">
                    <div className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm">
                      <DiscussionMetaRow
                        compact
                        discussion={{
                          time: new Date(post.time),
                          forum: snap?.forum ?? null,
                          author: snap?.author ?? null,
                          allRepliesCount: post._count.replies,
                          allParticipantsCount: post._replyParticipantCount ?? 0,
                        }}
                      />
                    </div>
                    <hr className="mt-7" />
                  </div>
                </div>
                <div className="transition-transform duration-300 ease-out will-change-transform">
                  {snap ? (
                    <OperationPanel
                      post={post}
                      snap={snap}
                      onRefresh={() => void handleRefresh()}
                      refreshing={refreshing}
                      onOpenWayback={() => setWaybackOpen(true)}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* 时光机（快照选择抽屉） */}
        {waybackOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setWaybackOpen(false)}
          >
            <div
              className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-background p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">时光机</h3>
                <button
                  type="button"
                  onClick={() => setWaybackOpen(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  关闭
                </button>
              </div>
              <ol className="space-y-2">
                {post.snapshots.map((s) => {
                  const token = new Date(s.capturedAt).getTime().toString(36);
                  const active = s === snap;
                  return (
                    <li key={s.capturedAt}>
                      <Link
                        href={`/d/${String(post.id)}@${token}`}
                        className={cn(
                          "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition",
                          active
                            ? "border-primary/60 bg-primary/10 text-foreground"
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        <span>{ABSOLUTE_DATE_FORMATTER.format(new Date(s.capturedAt))}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          @{token}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

async function crawlAndWait(
  id: number,
  setError: (msg: string) => void,
  setRefreshing: (v: boolean) => void,
): Promise<void> {
  setRefreshing(true);
  try {
    await api.crawl(id);
  } catch {
    /* 入队失败也继续轮询，可能已在队列中 */
  }
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 6000));
    try {
      await api.discussion(id);
      window.location.reload();
      return;
    } catch {
      /* 继续等待 */
    }
  }
  setError("2 分钟内未完成抓取：帖子可能已删除、需要权限，或队列繁忙。稍后重新输入 ID 可再试。");
  setRefreshing(false);
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center px-4 py-24">{children}</div>;
}
