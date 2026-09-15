import type { ReactNode } from "react";

import { Link } from "../../App";
import type { AuthorInfo } from "../../lib/api";
import { ABSOLUTE_DATE_FORMATTER, cn, formatRelativeTime } from "../../lib/utils";

import { MetaItem } from "../meta-item";
import UserInlineLink from "../user-inline-link";

/**
 * 移植自原版 apps/web/components/feed/feed-card-template.tsx。
 * headless 模式用于 Markdown 悬浮预览卡；非 headless 用于信息流大卡。
 */

type FeedKind = "discussion" | "article" | "paste" | "judgement";

const TYPE_META: Record<FeedKind, { label: string; badgeClass: string }> = {
  article: {
    label: "文章",
    badgeClass: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
  discussion: {
    label: "讨论",
    badgeClass: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  paste: {
    label: "云剪贴板",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  judgement: {
    label: "陶片放逐",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
};

export type FeedCardMetric = {
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
};

export function FeedCardTemplate({
  kind,
  time,
  metaTags = [],
  metaText,
  title,
  content,
  contentMaxLines,
  tags,
  metrics,
  user,
  href,
  headless = false,
  tabIndexOverride,
}: {
  kind: FeedKind;
  time: Date;
  metaTags?: ReactNode[] | null;
  metaText?: string | null;
  title?: string | null;
  content?: ReactNode | null;
  contentMaxLines?: number;
  tags?: ReactNode[] | null;
  metrics?: FeedCardMetric[] | null;
  user?: AuthorInfo | null;
  href?: string | null;
  headless?: boolean;
  tabIndexOverride?: number;
}) {
  return headless ? (
    <FeedCardTemplateContent
      kind={kind}
      time={time}
      metaTags={metaTags}
      metaText={metaText}
      title={title}
      content={content}
      contentMaxLines={contentMaxLines}
      tags={tags}
      metrics={metrics}
      user={user}
      preventInnerPointerEvents
    />
  ) : (
    <article>
      <div
        className={cn(
          "group relative flex flex-col rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition duration-200 hover:shadow-lg",
          href && "hover:-translate-y-1",
        )}
      >
        {href ? (
          <Link href={href} className="absolute inset-0 rounded-2xl" aria-label={title ?? undefined} />
        ) : null}
        <FeedCardTemplateContent
          kind={kind}
          time={time}
          metaTags={metaTags}
          metaText={metaText}
          title={title}
          content={content}
          contentMaxLines={contentMaxLines}
          tags={tags}
          metrics={metrics}
          user={user}
          preventPointerEvents={Boolean(href)}
          tabIndexOverride={tabIndexOverride}
        />
      </div>
    </article>
  );
}

export function FeedCardTemplateContent({
  kind,
  time,
  metaTags = [],
  metaText,
  title,
  content,
  contentMaxLines,
  tags,
  metrics,
  user,
  preventPointerEvents = false,
  preventInnerPointerEvents = false,
  tabIndexOverride,
}: {
  kind: FeedKind;
  time: Date;
  metaTags?: ReactNode[] | null;
  metaText?: string | null;
  title?: string | null;
  content?: ReactNode | null;
  contentMaxLines?: number;
  tags?: ReactNode[] | null;
  metrics?: FeedCardMetric[] | null;
  user?: AuthorInfo | null;
  preventPointerEvents?: boolean;
  preventInnerPointerEvents?: boolean;
  tabIndexOverride?: number;
}) {
  return (
    <div className={cn("z-1", preventPointerEvents && "pointer-events-none")}>
      <header className="flex items-center justify-between gap-3">
        <span className="inline-flex gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
              TYPE_META[kind].badgeClass,
            )}
          >
            {TYPE_META[kind].label}
          </span>
          {metaTags?.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center rounded-full bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </span>
        <time className="text-xs text-muted-foreground" dateTime={time.toISOString()}>
          {ABSOLUTE_DATE_FORMATTER.format(time)}
        </time>
      </header>
      <div className="mt-4 space-y-3">
        <h3 className="text-lg leading-tight font-semibold text-foreground">
          {title}
        </h3>
        {metaText ? <span className="text-muted-foreground">{metaText}</span> : null}
        <div
          className="fake-p my-2 text-base wrap-anywhere"
          style={{
            overflow: "hidden",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: contentMaxLines,
            lineClamp: contentMaxLines,
            textAutospace: "normal",
          }}
        >
          {content}
        </div>
        {tags?.length ? (
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-md bg-muted/70 px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        {metrics?.length ? (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            {metrics.map((metric, index) => (
              <MetaItem key={index} compact {...metric} />
            ))}
          </div>
        ) : null}
      </div>
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-muted-foreground">
        {user ? (
          <UserInlineLink
            user={user}
            avatar
            {...(preventInnerPointerEvents ? { link: false } : {})}
            {...(tabIndexOverride !== undefined ? { tabIndex: tabIndexOverride } : {})}
          />
        ) : (
          <span className="text-foreground">匿名用户</span>
        )}
        <time className="text-xs text-muted-foreground" dateTime={time.toISOString()}>
          {formatRelativeTime(time)}
        </time>
      </footer>
    </div>
  );
}
