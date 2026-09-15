import * as React from "react";
import {
  AtSign,
  ClipboardList,
  FileText,
  MessageSquare,
  MessageSquareReply,
  MessagesSquare,
  Swords,
} from "lucide-react";

import { Link } from "../../App";
import UserInlineLink from "../user-inline-link";
import { captureFromFirstMatch, discussionRegexes, userRegexes } from "../../lib/link";
import { useEntry, type DiscussEntry, type EntryRef, type UserEntry } from "../../lib/entries";
import { useMentionContext } from "../../lib/mention-context";
import { cn } from "../../lib/utils";
import luoguSvg from "../../../vendor/luogu.svg";

import { FeedCardTemplate } from "../feed/feed-card-template";
import { ForumDisplayShort } from "../forum-display";
import LinkWithOriginal from "./magic-link/link-with-original";
import UserMagicLinkDirect from "./magic-link/user/direct";
import UserMagicLinkWithOriginal from "./magic-link/user/with-original";
import { MentionReplyOverlayTrigger } from "./mention-reply-overlay";

/**
 * 移植自原版 apps/web/components/markdown/markdown-link.tsx：
 * 链接分类（讨论 / 文章 / 剪贴板 / 用户 / 题目 / @提及）、链接文字是否有信息量
 * 的判定，以及 magic-link 悬浮预览卡 + @提及「回复推断」浮层。
 */

const ZERO_WIDTH_REGEX = /[\u200b\u200c\u200d\u2060\ufeff]/g;
const URL_LIKE_PATTERN = /^(https?:\/\/|www\.|[a-z0-9.-]+\.[a-z]{2,})(?:\/|$)/i;

type ElementWithChildren = React.ReactElement<{ children?: React.ReactNode }>;

function extractTextFromChildren(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (React.isValidElement(child)) {
        return extractTextFromChildren((child as ElementWithChildren).props.children);
      }
      return "";
    })
    .join("")
    .trim();
}

function onlyHasImageChildren(children: React.ReactNode): boolean {
  return React.Children.toArray(children).every((child) => {
    if (React.isValidElement(child)) {
      const element = child as ElementWithChildren;
      if (element.type === "img") return true;
      if (element.props.children) return onlyHasImageChildren(element.props.children);
      return false;
    }
    return false;
  });
}

function extractLabelFromSource(source?: string): string {
  if (!source) return "";
  const match = source.match(/\[([\s\S]*?)\]/);
  return match ? (match[1] ?? "") : "";
}

function cleanPlainText(value?: string | null): string {
  if (!value) return "";
  return value.replace(ZERO_WIDTH_REGEX, "").replace(/\s+/g, " ").trim();
}

function normalizePlainText(value?: string | null): string {
  return cleanPlainText(value).toLowerCase();
}

function looksLikeUrl(label: string): boolean {
  return URL_LIKE_PATTERN.test(label.trim());
}

function normalizeUrlComparable(value?: string | null): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function normalizeHrefComparable(href: string): string {
  if (!href) return "";
  try {
    const parsed = new URL(href);
    const host = parsed.host.replace(/^www\./i, "");
    const path = parsed.pathname.replace(/\/$/, "");
    return `${host}${path}${parsed.search}${parsed.hash}`.toLowerCase();
  } catch {
    return normalizeUrlComparable(href);
  }
}

function escapeBackslash(value: string): string {
  let result = "";
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "\\") {
      i++;
      if (i < value.length) result += value[i];
    } else {
      result += char;
    }
  }
  return result;
}

type UsefulnessContext = {
  href: string;
  text?: string;
  rawSource?: string;
  kind: "discussion" | "article" | "paste" | "user" | "problem";
  referenceId?: string;
  referenceName?: string;
  referenceTitle?: string;
};

/** 判断链接文字是否提供了额外信息（否则改用条目自身的标题/名字展示）。 */
function isLinkTextUseful({
  href,
  text,
  rawSource,
  kind,
  referenceId,
  referenceName,
  referenceTitle,
}: UsefulnessContext): boolean {
  const labelRaw = escapeBackslash(extractLabelFromSource(rawSource));
  const label = cleanPlainText(text) || cleanPlainText(labelRaw);
  if (!label) return false;

  const normalizedHref = normalizeHrefComparable(href);
  if (normalizedHref && looksLikeUrl(label)) {
    if (normalizeUrlComparable(label) === normalizedHref) return false;
  }

  if (kind === "user" && referenceName) {
    const name = referenceName.toLowerCase();
    if ([name, `@${name}`].includes(labelRaw.trim().toLowerCase())) return false;
    if ([name, `@${name}`].includes(text?.trim().toLowerCase() ?? "")) return false;
  }

  if (kind === "user" && referenceId) {
    if ([referenceId, `@${referenceId}`].includes(labelRaw.trim())) return false;
    if ([referenceId, `@${referenceId}`].includes(text?.trim() ?? "")) return false;
    if ((captureFromFirstMatch(userRegexes, label)?.[1] ?? "") === referenceId) return false;
  }

  if ((kind === "discussion" || kind === "article" || kind === "problem") && referenceTitle) {
    const normalizedLabel = normalizePlainText(label);
    const normalizedTitle = normalizePlainText(referenceTitle);
    if (normalizedLabel && normalizedTitle && normalizedLabel === normalizedTitle) return false;
  }

  if (kind === "discussion" && referenceId) {
    if ((captureFromFirstMatch(discussionRegexes, label)?.[1] ?? "") === referenceId) return false;
  }

  return true;
}

type MarkdownLinkProps = React.ComponentProps<"a"> & {
  originalUrl?: string;
  "data-ls-user-mention"?: string;
  "data-ls-discuss"?: string;
  "data-ls-article"?: string;
  "data-ls-user"?: string;
  "data-ls-paste"?: string;
  "data-ls-problem"?: string;
  "data-ls-link-text"?: string;
  "data-ls-link-source"?: string;
};

export default function MarkdownLink(props: MarkdownLinkProps) {
  const { href, children, className, originalUrl, ...rest } = props;
  const mentionContext = useMentionContext();

  const pluginLinkText = props["data-ls-link-text"];
  const linkTextSource = props["data-ls-link-source"];

  const markdownLabel = React.useMemo(() => {
    const sourceLabel = extractLabelFromSource(linkTextSource);
    if (sourceLabel.trim()) return sourceLabel;
    if (pluginLinkText?.trim()) return pluginLinkText;
    return "";
  }, [linkTextSource, pluginLinkText]);

  const linkLabel = React.useMemo(
    () => markdownLabel || extractTextFromChildren(children),
    [children, markdownLabel],
  );

  const isBlankLink = href === null || href === undefined || href.trim() === "";

  const trueUrl = isBlankLink
    ? "#"
    : new URL(href ?? "", originalUrl ?? "https://www.luogu.com.cn/").toString();

  const ref: EntryRef | null = props["data-ls-discuss"]
    ? { type: "discuss", id: props["data-ls-discuss"] }
    : props["data-ls-article"]
      ? { type: "article", id: props["data-ls-article"] }
      : props["data-ls-user"] ?? props["data-ls-user-mention"]
        ? { type: "user", id: props["data-ls-user"] ?? props["data-ls-user-mention"] ?? "" }
        : props["data-ls-paste"]
          ? { type: "paste", id: props["data-ls-paste"] }
          : props["data-ls-problem"]
            ? { type: "problem", id: props["data-ls-problem"] }
            : null;

  const entry = useEntry(ref?.type ?? null, ref?.id);

  const onlyImagesInChildren = onlyHasImageChildren(children);

  // --- @用户提及 ---
  if (props["data-ls-user-mention"]) {
    const userEntry = entry?.type === "user" ? (entry.data as UserEntry | null) : null;
    if (userEntry) {
      const shouldEnableInference =
        mentionContext?.kind === "discussion" &&
        mentionContext.discussionId !== undefined &&
        mentionContext.relativeReplyId !== undefined;

      return (
        <span className="ls-user-mention inline-flex items-center">
          <AtSign className="relative top-0.5 inline-block size-4 stroke-[1.5] text-muted-foreground" />
          <span className="relative top-1 -ms-0.75 -mt-1 inline-flex items-center gap-0">
            <UserInlineLink
              user={{ ...userEntry, id: userEntry.uid }}
              compact
              avatar={false}
            />
            {shouldEnableInference ? (
              <MentionReplyOverlayTrigger
                discussionId={mentionContext.discussionId}
                mentionUserId={userEntry.uid}
                relativeReplyId={mentionContext.relativeReplyId}
                className="me-1 inline-flex cursor-pointer items-center gap-0.75 rounded-full bg-background/50 px-1.75 py-1.25 shadow-sm ring-1 ring-border backdrop-blur-xs transition duration-200 select-none hover:-translate-y-0.25 hover:shadow"
                isFromDiscussionAuthor={mentionContext.discussionAuthors.includes(
                  userEntry.uid,
                )}
              >
                <MessageSquareReply className="inline-block size-3 stroke-2" />
                <span className="inline-block text-xs leading-none">回复推断</span>
              </MentionReplyOverlayTrigger>
            ) : null}
          </span>
        </span>
      );
    }

    return (
      <span className="ls-user-mention inline-flex items-center gap-0.25">
        <AtSign className="relative top-0.5 inline-block size-4 stroke-[1.75]" />
        <span className="relative top-1 ms-0.25 me-0.75 -mt-1 inline-flex items-center gap-0 text-muted-foreground">
          {children ?? linkLabel}
        </span>
      </span>
    );
  }

  if (!isBlankLink) {
    // --- 讨论帖 ---
    if (entry?.type === "discuss") {
      const discussEntry = entry.data as DiscussEntry | null;
      if (!discussEntry) {
        return (
          <Link href={`/d/${entry.id}`} className={className}>
            <MessagesSquare
              className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
              aria-hidden="true"
            />
            {children ?? (linkLabel || `\u8ba8\u8bba\u2009${entry.id}`)}
          </Link>
        );
      }
      if (discussEntry) {
        const display = isLinkTextUseful({
          href: trueUrl,
          ...(linkLabel !== undefined ? { text: linkLabel } : {}),
          ...(linkTextSource !== undefined ? { rawSource: linkTextSource } : {}),
          kind: "discussion",
          referenceTitle: discussEntry.title,
          referenceId: entry.id,
        })
          ? (children ?? (linkLabel || `讨论\u2009${entry.id}`))
          : discussEntry.title;

        return (
          <LinkWithOriginal
            href={`/d/${entry.id}`}
            Icon={MessagesSquare}
            iconCorner={onlyImagesInChildren}
            original={display}
            preview={
              <FeedCardTemplate
                headless
                kind="discussion"
                time={new Date(discussEntry.time * 1000)}
                metaTags={[
                  <ForumDisplayShort forum={discussEntry.forum} key={discussEntry.forum?.slug ?? "forum"} />,
                ]}
                title={discussEntry.title}
                metrics={[
                  {
                    icon: MessageSquare,
                    children: `${String(discussEntry.replyCount)}\u2009回复`,
                  },
                ]}
                user={discussEntry.author}
              />
            }
          />
        );
      }
    }

    // --- 用户 ---
    if (entry?.type === "user") {
      const userEntry = entry.data as UserEntry | null;
      if (userEntry) {
        return !isLinkTextUseful({
          href: trueUrl,
          ...(markdownLabel !== undefined ? { text: markdownLabel } : {}),
          ...(linkTextSource !== undefined ? { rawSource: linkTextSource } : {}),
          kind: "user",
          referenceName: userEntry.name,
          referenceId: entry.id,
        }) ? (
          <UserMagicLinkDirect userInfo={userEntry} />
        ) : (
          <UserMagicLinkWithOriginal userInfo={userEntry}>
            {children ?? (linkLabel || trueUrl)}
          </UserMagicLinkWithOriginal>
        );
      }
      return (
        <a href={trueUrl} className={className} {...rest}>
          {children ?? (linkLabel || trueUrl)}
        </a>
      );
    }

    // --- 题目（未归档，回退洛谷原链）---
    if (entry?.type === "problem") {
      return (
        <a
          href={`https://www.luogu.com.cn/problem/${entry.id}`}
          className={className}
          {...rest}
          target="_blank"
          rel="noreferrer noopener"
        >
          <Swords
            className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
            aria-hidden="true"
          />
          {children ?? (linkLabel || `题目\u2009${entry.id}`)}
        </a>
      );
    }

    // --- 文章 / 云剪贴板（未归档，回退洛谷原链）---
    if (entry?.type === "article" || entry?.type === "paste") {
      const Icon = entry.type === "article" ? FileText : ClipboardList;
      const prefix = entry.type === "article" ? "article" : "paste";
      return (
        <a
          href={`https://www.luogu.com.cn/${prefix}/${entry.id}`}
          className={className}
          {...rest}
          target="_blank"
          rel="noreferrer noopener"
        >
          <Icon
            className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
            aria-hidden="true"
          />
          {children ?? (linkLabel || trueUrl)}
        </a>
      );
    }
  }

  const luoguRe = /^https?:\/\/(?:[a-zA-Z0-9\-. ]*\.)?luogu\.(?:com\.cn|com|org)(?:\/\S*)?/;
  return (
    <a
      href={trueUrl}
      className={className}
      {...rest}
      {...(luoguRe.test(trueUrl) ? {} : { target: "_blank", rel: "noopener noreferrer" })}
    >
      {luoguRe.test(trueUrl) && !onlyImagesInChildren ? (
        <img
          className="relative -top-0.5 me-0.5 inline-block h-[1.5em] w-[1.05em]"
          src={luoguSvg}
          alt="洛谷"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </a>
  );
}
