import type { DiscussionFeedEntry } from "../../lib/api";
import { ABSOLUTE_DATE_FORMATTER, formatRelativeTime } from "../../lib/utils";
import { Link } from "../../App";
import UserInlineLink from "../user-inline-link";

import { MetaItem } from "../meta-item";
import { ForumDisplayShort } from "../forum-display";
import { MessageSquare, CalendarClock } from "lucide-react";

/** 与原版 lib/markdown-plain-text 等价的轻量纯文本化（仅讨论卡摘要用） */
function markdownToPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

export const ABSOLUTE_DATE_FORMATTER_LOCAL = ABSOLUTE_DATE_FORMATTER;

export default function DiscussionFeedCard({ item }: { item: DiscussionFeedEntry }) {
  const timestamp = new Date(item.timestamp);
  const plainContent = markdownToPlainText(item.content?.trim() || "");

  return (
    <article>
      <div className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition duration-200 hover:shadow-lg hover:-translate-y-1">
        <Link
          href={`/d/${String(item.postId)}`}
          className="absolute inset-0 rounded-2xl"
          aria-label={item.title}
        />
        <div className="pointer-events-none z-1">
          <header className="flex items-center justify-between gap-3">
            <span className="inline-flex gap-1.5">
              <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-600 dark:text-violet-300">
                讨论
              </span>
              <span className="inline-flex items-center rounded-full bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground">
                <ForumDisplayShort forum={item.forum} />
              </span>
            </span>
            <time
              className="text-xs text-muted-foreground"
              dateTime={timestamp.toISOString()}
            >
              {ABSOLUTE_DATE_FORMATTER.format(timestamp)}
            </time>
          </header>
          <div className="mt-4 space-y-3">
            <h3 className="text-lg leading-tight font-semibold text-foreground">
              {item.title}
            </h3>
            <div
              className="fake-p my-2 text-base"
              style={{
                overflow: "hidden",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 4,
                lineClamp: 4,
              }}
            >
              {plainContent}
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <MetaItem compact icon={MessageSquare}>
                {`${String(item.replyCount)}\u2009回复`}
              </MetaItem>
              <MetaItem compact icon={CalendarClock}>
                {`最近\u2009${String(item.recentReplyCount)}\u2009回复`}
              </MetaItem>
            </div>
          </div>
          <footer className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-muted-foreground">
            {item.author ? (
              <UserInlineLink user={item.author} avatar />
            ) : (
              <span className="text-foreground">匿名用户</span>
            )}
            <time
              className="text-xs text-muted-foreground"
              dateTime={timestamp.toISOString()}
            >
              {formatRelativeTime(timestamp)}
            </time>
          </footer>
        </div>
      </div>
    </article>
  );
}
