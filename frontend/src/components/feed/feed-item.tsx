import { CalendarClock, MessageSquare } from "lucide-react";

import type { DiscussionFeedEntry } from "../../lib/api";
import { renderMarkdownToPlainText } from "../../lib/markdown-plain-text";

import { ForumDisplayShort } from "../forum-display";
import { FeedCardTemplate } from "./feed-card-template";

/**
 * 移植自原版 apps/web/components/feed/feed-item.tsx（仅讨论分支）。
 * 原版这里是一个把 FeedEntry 适配到 FeedCardTemplate 的薄适配层。
 */
export function FeedCard({
  item,
  headless,
  tabIndexOverride,
}: {
  item: DiscussionFeedEntry;
  headless?: boolean;
  tabIndexOverride?: number;
}) {
  const timestamp = new Date(item.timestamp);
  const rawContent = item.content?.trim() || "";
  const plainContent =
    rawContent.length > 0 ? renderMarkdownToPlainText(rawContent) : "";

  return (
    <FeedCardTemplate
      href={`/d/${String(item.postId)}`}
      kind="discussion"
      time={timestamp}
      metaTags={[
        <ForumDisplayShort forum={item.forum} key={item.forum?.slug ?? "forum"} />,
      ]}
      title={item.title}
      content={plainContent}
      contentMaxLines={4}
      metrics={[
        {
          icon: MessageSquare,
          children: `${item.replyCount.toLocaleString("zh-CN")}\u2009回复`,
        },
        {
          icon: CalendarClock,
          children: `最近\u2009${item.recentReplyCount.toLocaleString("zh-CN")}\u2009回复`,
        },
      ]}
      user={item.author}
      {...(headless !== undefined ? { headless } : {})}
      {...(tabIndexOverride !== undefined ? { tabIndexOverride } : {})}
    />
  );
}

export default FeedCard;
