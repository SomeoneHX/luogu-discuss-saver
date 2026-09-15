import type { LucideIcon } from "lucide-react";

import { Link } from "../../../App";
import { cn } from "../../../lib/utils";

import LinkWithOriginalRaw from "./link-with-original-raw";

/** 移植自原版 magic-link/link-with-original.tsx（站内链接 + 悬浮预览）。 */
export default function LinkWithOriginal({
  href,
  Icon,
  preview,
  original,
  className,
  iconCorner = false,
  singleLine = false,
  targetBlank = false,
}: {
  href: string;
  Icon: LucideIcon;
  preview: React.ReactNode;
  original: React.ReactNode;
  className?: string;
  iconCorner?: boolean;
  singleLine?: boolean;
  targetBlank?: boolean;
}) {
  return (
    <LinkWithOriginalRaw
      preview={preview}
      originalRaw={
        targetBlank ? (
          <a
            href={href}
            className={cn(
              "ls-inline-reference ls-link-preview relative no-underline",
              !iconCorner && "mx-0.25",
              className,
            )}
            target="_blank"
            rel="noreferrer noopener"
          >
            {iconCorner ? (
              <div className="absolute -top-0.5 right-0.25 rounded-full bg-orange-500/60 p-0.5 leading-0">
                <Icon className="m-0.5 inline-block size-3.5 stroke-[1.75] text-white" />
              </div>
            ) : (
              <Icon className="icon relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]" />
            )}
            <span>{original}</span>
          </a>
        ) : (
          <Link
            href={href}
            className={cn(
              "ls-inline-reference ls-link-preview relative no-underline",
              !iconCorner && "mx-0.25",
              className,
            )}
          >
            {iconCorner ? (
              <div className="absolute -top-0.5 right-0.25 rounded-full bg-orange-500/60 p-0.5 leading-0">
                <Icon className="m-0.5 inline-block size-3.5 stroke-[1.75] text-white" />
              </div>
            ) : (
              <Icon className="icon relative top-[0.03125em] me-0.5 -mt-[0.25em] inline-block size-[1em]" />
            )}
            <span>{original}</span>
          </Link>
        )
      }
      className={className}
      singleLine={singleLine}
    />
  );
}
