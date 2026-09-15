import * as React from "react";
import {
  LoaderCircle,
  RefreshCcw,
  SquareCheckBig,
  TriangleAlert,
} from "lucide-react";

import { cn } from "../../lib/utils";

export type QueueJobButtonProps = {
  onTrigger: () => Promise<void>;
  idleText: string;
  pendingText?: string;
  successText?: string;
  errorText?: string;
  className?: string;
};

const STATUS_RESET_DELAY = 1500;

type Status = "idle" | "success" | "error";

/** 对应原版 components/operation-panel/queue-job-button.tsx（原文案一致）。 */
export function QueueJobButton({
  onTrigger,
  idleText,
  pendingText = "正在加入更新队列",
  successText = "更新任务已创建",
  errorText = "任务创建失败，点击重试",
  className,
}: QueueJobButtonProps) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [isPending, setIsPending] = React.useState(false);
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = React.useCallback(() => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  }, []);

  React.useEffect(() => clearTimer, [clearTimer]);

  const runTrigger = React.useCallback(() => {
    void (async () => {
      clearTimer();
      setStatus("idle");
      setIsPending(true);
      try {
        await onTrigger();
        setStatus("success");
        resetTimer.current = setTimeout(() => {
          setStatus("idle");
          resetTimer.current = null;
        }, STATUS_RESET_DELAY);
      } catch {
        setStatus("error");
      } finally {
        setIsPending(false);
      }
    })();
  }, [clearTimer, onTrigger]);

  const icon = isPending ? (
    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
  ) : status === "success" ? (
    <SquareCheckBig className="size-4" aria-hidden="true" />
  ) : status === "error" ? (
    <TriangleAlert className="size-4" aria-hidden="true" />
  ) : (
    <RefreshCcw className="size-4" aria-hidden="true" />
  );

  const text = isPending
    ? pendingText
    : status === "success"
      ? successText
      : status === "error"
        ? errorText
        : idleText;

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-start gap-2 rounded-2xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/60 disabled:opacity-60",
        className,
      )}
      onClick={runTrigger}
      disabled={isPending}
      aria-live="polite"
    >
      {icon}
      {text}
    </button>
  );
}
