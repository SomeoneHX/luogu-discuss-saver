import { Link } from "../App";
import { MessageCircle, MessageCircleDashed } from "lucide-react";
import type { PostCard } from "../lib/api";
import { formatAbsolute, formatRelativeTime } from "../lib/utils";
import { ForumDisplay } from "./forum-display";
import { MetaItem } from "./meta-item";
import UserInlineLink from "./user-inline-link";

export default function TrendingEntryDiscussion({ post }: { post: PostCard }) {
  const rawContent = post.content?.trim() || "";
  const plainContent = rawContent.length > 0 ? plainText(rawContent) : "";
  return (
    <article>
      <div className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg">
        <Link href={`/d/${String(post.id)}`} className="absolute inset-0 rounded-2xl" />
        <div className="z-[1] pointer-events-none">
          <header className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-600 dark:text-violet-300">
                讨论
              </span>
              {post.forum ? (
                <span className="inline-flex items-center rounded-full bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground">
                  <ForumDisplay forum={post.forum} />
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <time className="text-xs text-muted-foreground" dateTime={new Date(post.time * 1000).toISOString()}>
                {formatAbsolute(new Date(post.time * 1000))}
              </time>
              <time className="text-xs text-muted-foreground" dateTime={new Date(post.time * 1000).toISOString()}>
                {formatRelativeTime(new Date(post.time * 1000))}
              </time>
            </div>
          </header>
          <div className="mt-4 space-y-3">
            <h3 className="text-lg leading-tight font-semibold text-foreground">{post.title}</h3>
            <div
              className="fake-p my-2 text-base break-all"
              style={{
                overflow: "hidden",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 3,
                lineClamp: 3,
              }}
            >
              {plainContent}
            </div>
          </div>
          <footer className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <span className="pointer-events-auto">
              <UserInlineLink user={post.author} />
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <MetaItem compact icon={MessageCircle}>{`${String(post.replyCount)}\u2009评论`}</MetaItem>
              <MetaItem compact icon={MessageCircleDashed}>
                {`已保存\u2009${String(post.savedReplyCount)}\u2009评论`}
              </MetaItem>
            </div>
          </footer>
        </div>
      </div>
    </article>
  );
}

function plainText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " [代码] ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`~_[\]-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
