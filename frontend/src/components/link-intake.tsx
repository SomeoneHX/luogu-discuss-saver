import * as React from "react";
import {
  LoaderCircle,
  RefreshCcw,
  SquareCheckBig,
  TriangleAlert,
} from "lucide-react";

import { api } from "../lib/api";
import { cn } from "../lib/utils";

const STATUS_RESET_DELAY = 1500;
type Status = "idle" | "pending" | "success" | "error";

type Detected =
  | { kind: "discussion"; id: number; label: string }
  | null;

function detectLink(raw: string): Detected | null {
  const input = raw.trim();
  if (!input) return null;

  // 洛谷讨论帖链接或纯数字 ID
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?luogu\.com\.cn\/discuss\/show\?postid=(\d+)/i,
    /(?:https?:\/\/)?(?:www\.)?luogu\.com\.cn\/discuss\/(\d+)/i,
    /^(\d+)$/,
  ];
  for (const re of patterns) {
    const m = input.match(re);
    if (m?.[1]) {
      const id = Number.parseInt(m[1], 10);
      if (!Number.isNaN(id)) {
        return { kind: "discussion", id, label: `已识别到帖子 ${String(id)}` };
      }
    }
  }
  return null;
}

export function LinkIntake() {
  const [value, setValue] = React.useState("");
  const [detected, setDetected] = React.useState<Detected>(null);
  const [status, setStatus] = React.useState<Status>("idle");
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setDetected(detectLink(value));
  }, [value]);

  const resetStatusLater = React.useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(
      () => setStatus("idle"),
      STATUS_RESET_DELAY,
    );
  }, []);

  const onSubmit = React.useCallback(async () => {
    if (!detected || !value.trim()) return;
    setStatus("pending");
    try {
      await api.crawl(detected.id);
      setStatus("success");
      setValue("");
      setDetected(null);
      resetStatusLater();
    } catch {
      setStatus("error");
      resetStatusLater();
    }
  }, [detected, value, resetStatusLater]);

  const helperText = !value.trim()
    ? ""
    : detected?.label
      ? detected.label
      : "未识别到有效链接";

  const buttonText =
    status === "pending"
      ? "正在加入保存队列"
      : status === "success"
        ? "已加入保存队列"
        : status === "error"
          ? "添加失败，点击重试"
          : "加入保存队列";

  const icon =
    status === "pending" ? (
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
    ) : status === "success" ? (
      <SquareCheckBig className="size-4" aria-hidden />
    ) : status === "error" ? (
      <TriangleAlert className="size-4" aria-hidden />
    ) : (
      <RefreshCcw className="size-4" aria-hidden />
    );

  const disabled = status === "pending" || !detected || !value.trim();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-y-3 px-2">
      <div className="flex w-full flex-col gap-y-3 sm:flex-row sm:items-stretch">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void onSubmit();
            }
          }}
          placeholder="粘贴洛谷链接，自动识别并加入保存队列"
          className="block h-12 flex-1 rounded-2xl border border-input bg-background px-5 py-3.5 text-center font-mono text-foreground shadow-sm outline-none transition focus:border-ring sm:rounded-l-3xl sm:rounded-r-none sm:text-left"
        />
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={disabled}
          className={cn(
            "block h-12 min-w-48 cursor-pointer justify-center rounded-2xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
            "sm:rounded-l-none sm:rounded-r-3xl",
          )}
          aria-live="polite"
        >
          <span className="flex items-center justify-center gap-2 pe-1.5">
            {icon}
            {buttonText}
          </span>
        </button>
      </div>
      <div
        className="h-6 w-full px-1 text-center text-sm text-muted-foreground sm:text-left"
        aria-live="polite"
      >
        {helperText}
      </div>
    </div>
  );
}
