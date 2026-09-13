import * as React from "react";
import {
  AtSign,
  ClipboardList,
  FileText,
  MessagesSquare,
  Swords,
} from "lucide-react";

import { Link } from "../../App";
import UserInlineLink from "../user-inline-link";
import { cn } from "../../lib/utils";
import luoguSvg from "../../../vendor/luogu.svg";

/**
 * 原版 markdown-link.tsx 的移植版。差异：原版用 react-query entryLoader
 * 取帖子/文章/剪贴板元数据渲染悬浮预览卡（magic-link 体系）；本项目无该
 * 基础设施，站内已知类型直接走站内路由，未知类型回退洛谷原链。
 */

const ZERO_WIDTH_REGEX = /[\u200b\u200c\u200d\u2060\ufeff]/g;

type MentionUser = {
  id: number;
  name: string;
  color: string;
  badge: string | null;
  ccfLevel: number;
  xcpcLevel: number;
};

/** 模块级用户信息缓存（@提及渲染用），会话内有效 */
const userCache = new Map<number, MentionUser | null>();
const userFetches = new Map<number, Promise<MentionUser | null>>();

async function loadMentionUser(uid: number): Promise<MentionUser | null> {
  const hit = userCache.get(uid);
  if (hit !== undefined) return hit;
  let pending = userFetches.get(uid);
  if (!pending) {
    pending = fetch(`/api/users/${String(uid)}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const bundle = (await res.json()) as {
          profile: {
            id: string;
            name: string;
            nameColor: string;
            badge?: string;
            ccfLevel?: number;
            xcpcLevel?: number;
          };
        };
        const user: MentionUser = {
          id: uid,
          name: bundle.profile.name,
          color: bundle.profile.nameColor,
          badge: bundle.profile.badge ?? null,
          ccfLevel: bundle.profile.ccfLevel ?? 0,
          xcpcLevel: bundle.profile.xcpcLevel ?? 0,
        };
        userCache.set(uid, user);
        return user;
      })
      .catch(() => null);
    userFetches.set(uid, pending);
  }
  return pending;
}

function useMentionUser(uid: number): MentionUser | null {
  const [user, setUser] = React.useState<MentionUser | null>(
    () => userCache.get(uid) ?? null,
  );
  React.useEffect(() => {
    let cancelled = false;
    void loadMentionUser(uid).then((u) => {
      if (!cancelled && u) setUser(u);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);
  return user;
}

const LUOGU_RE =
  /^https?:\/\/(?:[a-zA-Z0-9\-\.]*\.)?luogu\.(?:com\.cn|com|org)(?:\/\S*)?/;

type MarkdownLinkProps = React.ComponentProps<"a"> & {
  "data-ls-user-mention"?: string;
  "data-ls-discuss"?: string;
  "data-ls-article"?: string;
  "data-ls-user"?: string;
  "data-ls-paste"?: string;
  "data-ls-problem"?: string;
};

export default function MarkdownLink(props: MarkdownLinkProps) {
  const {
    href,
    children,
    className,
    "data-ls-user-mention": userMention,
    "data-ls-discuss": lsDiscuss,
    "data-ls-article": lsArticle,
    "data-ls-user": lsUser,
    "data-ls-paste": lsPaste,
    "data-ls-problem": lsProblem,
    ...rest
  } = props;

  const isBlankLink = href === null || href === undefined || href.trim() === "";
  const trueUrl = isBlankLink
    ? "#"
    : new URL(href ?? "", "https://www.luogu.com.cn/").toString();

  // --- @用户提及（remark-lda-lfm userMention）---
  if (userMention) {
    const uid = Number(userMention);
    return (
      <MentionSpan
        uid={Number.isInteger(uid) ? uid : 0}
        fallback={children}
      />
    );
  }

  // --- 站内已归档类型 ---
  if (!isBlankLink && lsDiscuss) {
    return (
      <Link href={`/d/${lsDiscuss}`} className={className} {...rest}>
        <MessagesSquare
          className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
          aria-hidden="true"
        />
        {children ?? `讨论\u2009${lsDiscuss}`}
      </Link>
    );
  }

  if (!isBlankLink && (lsUser ?? props["data-ls-user-mention"])) {
    const uid = lsUser ?? props["data-ls-user-mention"] ?? "";
    return (
      <Link href={`/u/${uid}`} className={className} {...rest}>
        {children ?? `用户\u2009${uid}`}
      </Link>
    );
  }

  if (!isBlankLink && lsProblem) {
    return (
      <a
        href={`https://www.luogu.com.cn/problem/${lsProblem}`}
        className={className}
        {...rest}
        target="_blank"
        rel="noreferrer noopener"
      >
        <Swords
          className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
          aria-hidden="true"
        />
        {children ?? `题目\u2009${lsProblem}`}
      </a>
    );
  }

  // 文章 / 云剪贴板：本项目未收录，回退洛谷原链（保留图标语义）
  if (!isBlankLink && (lsArticle || lsPaste)) {
    const icon = lsArticle ? (
      <FileText
        className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
        aria-hidden="true"
      />
    ) : (
      <ClipboardList
        className="relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]"
        aria-hidden="true"
      />
    );
    return (
      <a
        href={trueUrl}
        className={className}
        {...rest}
        target="_blank"
        rel="noreferrer noopener"
      >
        {icon}
        {children}
      </a>
    );
  }

  return (
    <a
      href={trueUrl ?? "#"}
      className={className}
      {...rest}
      {...(LUOGU_RE.test(trueUrl) ? {} : { target: "_blank", rel: "noopener noreferrer" })}
    >
      {LUOGU_RE.test(trueUrl) ? (
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

function MentionSpan({
  uid,
  fallback,
}: {
  uid: number;
  fallback: React.ReactNode;
}) {
  const user = useMentionUser(uid);
  if (user) {
    return (
      <span className="ls-user-mention inline-flex items-center">
        <AtSign
          className={cn(
            "relative top-0.5 inline-block size-4 stroke-[1.5] text-muted-foreground",
          )}
        />
        <span className="relative top-1 -ms-0.75 -mt-1 inline-flex items-center gap-0">
          <UserInlineLink user={{ ...user, avatar: "" }} compact avatar={false} />
        </span>
      </span>
    );
  }
  return (
    <span className="ls-user-mention inline-flex items-center gap-0.25">
      <AtSign className="relative top-0.5 inline-block size-4 stroke-[1.75]" />
      <span className="relative top-1 ms-0.25 me-0.75 -mt-1 inline-flex items-center gap-0 text-muted-foreground">
        {fallback}
      </span>
    </span>
  );
}
