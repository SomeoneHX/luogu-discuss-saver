import * as React from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";

import type { ReplyInfo } from "../../lib/api";
import { cn } from "../../lib/utils";

import CommentCard from "../comment-card";

/**
 * 「回复推断」浮层（移植自原版 components/markdown/mention-reply-overlay.tsx）。
 *
 * @提及旁的小按钮：点击后在浮层里展示被 @ 的这位用户在**本帖**里的回复，
 * 默认定位到「当前这条回复的上一条该用户回复」，可用左右箭头翻该用户的历史回复。
 */

export type MentionReply = {
  id: number;
  postId: number;
  time: number;
  content: string;
  capturedAt: number;
  lastSeenAt: number;
  authorId: number;
  author: ReplyInfo["author"];
  snapshotsCount: number;
};

export type MentionReplyInferenceResult = {
  reply: MentionReply;
  previousReplyId: number | null;
  nextReplyId: number | null;
  hasPrevious: boolean;
  hasNext: boolean;
};

type RectSnapshot = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

type OverlayState = {
  open: boolean;
  anchorRect: RectSnapshot | null;
  containerRect: RectSnapshot | null;
};

function snapshotRect(rect: DOMRect): RectSnapshot {
  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

async function fetchMentionReply(params: {
  discussionId: number;
  userId: number;
  cursor?: number;
  relativeTo?: number;
}): Promise<MentionReplyInferenceResult> {
  const url = new URL(
    `/api/discussions/${String(params.discussionId)}/reply-inference/${String(params.userId)}`,
    window.location.origin,
  );
  if (params.cursor) url.searchParams.set("cursor", String(params.cursor));
  if (params.relativeTo) url.searchParams.set("relativeTo", String(params.relativeTo));
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new Error("Failed to load mention reply");
  return (await response.json()) as MentionReplyInferenceResult;
}

export function MentionReplyOverlayTrigger({
  discussionId,
  mentionUserId,
  relativeReplyId,
  children,
  className,
  isFromDiscussionAuthor,
}: {
  discussionId: number;
  mentionUserId: number;
  relativeReplyId?: number;
  children: React.ReactNode;
  className?: string;
  isFromDiscussionAuthor?: boolean;
}) {
  const [overlayState, setOverlayState] = React.useState<OverlayState>({
    open: false,
    anchorRect: null,
    containerRect: null,
  });
  const [data, setData] = React.useState<MentionReplyInferenceResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const anchorRef = React.useRef<HTMLButtonElement | null>(null);
  const overlayRef = React.useRef<HTMLDivElement | null>(null);

  const loadData = React.useCallback(
    async (options?: { cursor?: number; relative?: number }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchMentionReply({
          discussionId,
          userId: mentionUserId,
          ...(options?.cursor !== undefined ? { cursor: options.cursor } : {}),
          ...(options?.relative !== undefined ? { relativeTo: options.relative } : {}),
        });
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [discussionId, mentionUserId],
  );

  const handleOpen = React.useCallback(() => {
    const anchorEl = anchorRef.current;
    if (!anchorEl) return;
    const anchorRect = snapshotRect(anchorEl.getBoundingClientRect());
    const cardElement = anchorEl.closest(".comment-card");
    const containerRect = snapshotRect(
      (cardElement instanceof HTMLElement ? cardElement : anchorEl).getBoundingClientRect(),
    );
    setOverlayState({ open: true, anchorRect, containerRect });
    if (!data && !loading) void loadData({ relative: relativeReplyId });
  }, [data, loadData, loading, relativeReplyId]);

  const handleClose = React.useCallback(() => {
    setOverlayState({ open: false, anchorRect: null, containerRect: null });
  }, []);

  const handlePrev = React.useCallback(() => {
    if (!data?.previousReplyId) return;
    void loadData({ cursor: data.previousReplyId });
  }, [data?.previousReplyId, loadData]);

  const handleNext = React.useCallback(() => {
    if (!data?.nextReplyId) return;
    void loadData({ cursor: data.nextReplyId });
  }, [data?.nextReplyId, loadData]);

  React.useEffect(() => {
    if (!overlayState.open) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    const onClickOutside = (event: MouseEvent) => {
      if (!overlayRef.current || !overlayState.open) return;
      if (event.target instanceof Node && overlayRef.current.contains(event.target)) return;
      if (anchorRef.current && event.target instanceof Node && anchorRef.current.contains(event.target)) {
        return;
      }
      handleClose();
    };
    document.addEventListener("keydown", onEsc);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [handleClose, overlayState.open]);

  const recomputeLayout = React.useCallback(() => {
    if (!overlayState.open) return;
    const anchorEl = anchorRef.current;
    if (!anchorEl) return;
    const anchorRect = snapshotRect(anchorEl.getBoundingClientRect());
    const cardElement = anchorEl.closest(".comment-card");
    const containerRect = snapshotRect(
      (cardElement instanceof HTMLElement ? cardElement : anchorEl).getBoundingClientRect(),
    );
    setOverlayState((prev) => (prev.open ? { ...prev, anchorRect, containerRect } : prev));
  }, [overlayState.open]);

  React.useEffect(() => {
    if (!overlayState.open) return;
    const handleResize = () => {
      recomputeLayout();
    };
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [overlayState.open, recomputeLayout]);

  const positionStyles = React.useMemo<React.CSSProperties>(() => {
    const anchorRect = overlayState.anchorRect;
    const containerRect = overlayState.containerRect ?? anchorRect;
    if (!anchorRect || !containerRect) return {};
    const width = containerRect.width;
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : undefined;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : undefined;
    const overlayHeight = 240;
    const rawTop = anchorRect.bottom + 8;
    let left = containerRect.left;
    if (viewportWidth && width) {
      left = width >= viewportWidth ? 0 : Math.max(0, Math.min(containerRect.left, viewportWidth - width));
    }
    const top = viewportHeight
      ? Math.min(rawTop, Math.max(8, viewportHeight - overlayHeight))
      : rawTop;
    return { top, left, width };
  }, [overlayState.anchorRect, overlayState.containerRect]);

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        className={cn(
          "mention-reply-trigger text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
        onClick={overlayState.open ? handleClose : handleOpen}
        aria-label="查看被提到的人都说了什么"
      >
        {children}
      </button>
      {overlayState.open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={overlayRef}
              className="mention-reply-overlay fixed z-50 rounded-2xl border border-border bg-popover/50 p-4 text-sm shadow-lg backdrop-blur-xs"
              style={positionStyles}
            >
              <div>
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="ms-2">加载中…</span>
                  </div>
                ) : error ? (
                  <div className="text-sm text-destructive">{error}</div>
                ) : data ? (
                  <CommentCard
                    reply={{
                      id: data.reply.id,
                      postId: data.reply.postId,
                      authorId: data.reply.authorId,
                      time: new Date(data.reply.time * 1000).toISOString(),
                      author: data.reply.author,
                      snapshots: [
                        {
                          content: data.reply.content,
                          capturedAt: new Date(data.reply.capturedAt * 1000).toISOString(),
                          lastSeenAt: new Date(data.reply.lastSeenAt * 1000).toISOString(),
                        },
                      ],
                      _count: { snapshots: data.reply.snapshotsCount },
                    }}
                    isFromDiscussionAuthor={Boolean(isFromDiscussionAuthor)}
                    maxHeight={480}
                  />
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <IconButton
                  disabled={!data?.hasPrevious || loading}
                  onClick={handlePrev}
                  label="上一条该用户的回复"
                >
                  <ArrowLeft className="size-4" />
                </IconButton>
                <IconButton
                  disabled={!data?.hasNext || loading}
                  onClick={handleNext}
                  label="下一条该用户的回复"
                >
                  <ArrowRight className="size-4" />
                </IconButton>
                <div className="grow" />
                <IconButton onClick={handleClose} label="关闭">
                  <X className="size-4" />
                </IconButton>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function IconButton({
  children,
  disabled,
  onClick,
  label,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors",
        "hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {children}
    </button>
  );
}
