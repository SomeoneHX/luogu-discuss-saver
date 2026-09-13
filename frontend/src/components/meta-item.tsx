import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function MetaItem({
  icon: Icon,
  children,
  compact = false,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-muted-foreground",
        compact && "gap-1",
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      <span className={cn(compact && "text-sm")}>{children}</span>
    </span>
  );
}
