import * as React from "react";
import { Camera, ClipboardCheck, ClipboardCopy } from "lucide-react";

import type { ReplyInfo } from "../lib/api";
import { cn, formatRelativeTime } from "../lib/utils";
import Markdown, { type MarkdownMentionContext } from "./markdown";
import { MetaItem } from "./meta-item";
import UserInlineLink from "./user-inline-link";

/** 复制到剪贴板 + 1.5s 反馈（原版 comment-card.tsx 同款交互）。 */
export function useClipboard(): [boolean, (text: string) => void] {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = React.useCallback((text: string) => {
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }, []);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return [copied, copy];
}

/**
 * 回复卡片（移植自原版 components/comments/comment-card.tsx）。
 * 帖子页与「回复推断」浮层共用；浮层传 maxHeight 让长回复内部滚动。
 */
export default function CommentCard({
  reply,
  isFromDiscussionAuthor,
  maxHeight,
  mentionContext,
  className,
}: {
  reply: ReplyInfo;
  isFromDiscussionAuthor: boolean;
  maxHeight?: number;
  mentionContext?: MarkdownMentionContext;
  className?: string;
}) {
  const [copied, copy] = useClipboard();
  const content = reply.snapshots[0]?.content ?? "";
  return (
    <article id={`reply-${String(reply.id)}`} className={className}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {reply.author ? <UserInlineLink user={reply.author} /> : null}
          {isFromDiscussionAuthor ? (
            <span className="inline-flex items-center rounded-full bg-pink-500 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-pink-400">
              楼主
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <MetaItem>{formatRelativeTime(new Date(reply.time))}</MetaItem>
          <MetaItem icon={Camera}>
            {"快照\u2009"}
            {String(reply._count?.snapshots ?? reply.snapshots.length)}
            {"\u2009份"}
          </MetaItem>
        </div>
      </header>
      <div className="comment-card group/comment-card relative mt-1.5 rounded-2xl border border-muted/75 bg-muted/75">
        <div
          className="m-3 leading-relaxed sm:m-3.5"
          style={{
            maxHeight,
            overflow: maxHeight === undefined ? "visible" : "auto",
          }}
        >
          <Markdown compact mentionContext={mentionContext}>
            {content}
          </Markdown>
        </div>
        <span
          className={cn(
            "comment-card-footer pointer-events-none absolute -bottom-4 left-1 z-1 opacity-0 transition-opacity duration-150",
            "group-focus-within/comment-card:pointer-events-auto group-focus-within/comment-card:opacity-100",
            "group-hover/comment-card:pointer-events-auto group-hover/comment-card:opacity-100 sm:left-1.5",
          )}
        >
          <button
            className="relative top-0 inline-flex cursor-pointer items-center gap-1 rounded-full bg-background/50 px-2.5 py-1.5 text-xs text-muted-foreground shadow ring-1 ring-border backdrop-blur-xs transition-[color,top] duration-200 select-none hover:-top-0.25 hover:text-foreground"
            onClick={() => {
              copy(content);
            }}
            aria-live="polite"
          >
            {copied ? (
              <ClipboardCheck className="inline-block size-3.5" />
            ) : (
              <ClipboardCopy className="inline-block size-3.5" />
            )}
            {copied ? "已复制" : "复制内容"}
          </button>
        </span>
      </div>
    </article>
  );
}
