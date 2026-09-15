import { ClipboardX, FileX, MessageSquareX, UserRoundX } from "lucide-react";

import { api } from "../../lib/api";
import { NotFoundTemplate } from "./not-found-template";

/**
 * 各场景的「未找到」页面，对应原版 app 下各自的 not-found.tsx。
 * 文案、图标、按钮四态与上游逐字一致。
 */

/** 讨论未收录 / 已删除（原版 (discussion)/not-found.tsx）。 */
export function DiscussionNotFound({ id }: { id: number }) {
  return (
    <NotFoundTemplate
      Icon={MessageSquareX}
      title="掘地三尺也找不到这条帖子！"
      hint="这条讨论尚未收录或已被删除。如果您希望保存这条讨论，可以尝试点击下方按钮将其加入任务队列。"
      queueJobButtonProps={
        Number.isFinite(id)
          ? {
              idleText: "尝试保存该讨论",
              pendingText: "正在加入保存队列",
              successText: "保存任务已创建",
              errorText: "任务创建失败，点击重试",
              onTrigger: () => api.crawl(id),
            }
          : undefined
      }
    />
  );
}

/** 用户未收录（原版 (user)/u/[id]/not-found.tsx）。 */
export function UserNotFound() {
  return (
    <NotFoundTemplate
      Icon={UserRoundX}
      title="可恶！这位用户太神秘了！"
      hint="这位用户尚未收录或不存在，目前尚不支持直接保存用户。"
    />
  );
}

/** 文章未收录（原版 (article)/not-found.tsx）：本项目不归档文章，故不提供入队按钮。 */
export function ArticleNotFound() {
  return (
    <NotFoundTemplate
      Icon={FileX}
      title="文章随风而去了～"
      hint="这篇文章尚未收录或已被删除。本项目只归档讨论帖，文章请前往洛谷原站查看。"
    />
  );
}

/** 云剪贴板未收录（原版 (paste)/not-found.tsx）：同上。 */
export function PasteNotFound() {
  return (
    <NotFoundTemplate
      Icon={ClipboardX}
      title="云剪贴板似乎飘走了？"
      hint="这份云剪贴板尚未收录或已被删除。本项目只归档讨论帖，云剪贴板请前往洛谷原站查看。"
    />
  );
}

/** 未定义路由：原版没有全局 not-found.tsx，由 Next 内置 404 兜底。 */
export function DefaultNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold text-foreground">404</h1>
      <p className="text-sm text-muted-foreground">This page could not be found.</p>
    </div>
  );
}
