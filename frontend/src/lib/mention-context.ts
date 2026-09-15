import * as React from "react";

/** Markdown 渲染时的提及/链接上下文（帖子页在回复卡片上注入）。 */
export type MarkdownMentionContext = {
  kind: "discussion";
  discussionId: number;
  relativeReplyId?: number;
  discussionAuthors: number[];
};

export const MentionContext = React.createContext<MarkdownMentionContext | undefined>(
  undefined,
);

export function useMentionContext(): MarkdownMentionContext | undefined {
  return React.useContext(MentionContext);
}
