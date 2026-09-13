import * as React from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "../../lib/utils";

/** 原版 markdown-code-block.tsx 同款（去 shadcn 依赖，视觉一致） */
type ElementWithChildren = React.ReactElement<{ children?: React.ReactNode }>;

function extractPlainText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (child === null || child === undefined) return "";
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (React.isValidElement(child)) {
        return extractPlainText((child as ElementWithChildren).props.children);
      }
      return "";
    })
    .join("");
}

function formatLanguageLabel(language?: string | null): string {
  if (!language) return "";
  return language.toUpperCase();
}

type MarkdownCodeBlockProps = {
  children: React.ReactNode;
  className?: string;
  language?: string;
  showLineNumbers: boolean;
  highlightLines: Set<number>;
};

function computeLineNumbers(
  children: React.ReactNode,
  highlightLines: Set<number>,
): Record<number, boolean> | undefined {
  if (Array.isArray(children)) {
    const lineNumbers: Record<number, boolean> = {};
    let lineIndex = 1;

    for (let k = 0; k < children.length; ++k) {
      const child = children[k];
      if (typeof child === "string") {
        const numLines =
          child.split("\n").length - (k === children.length - 1 ? 1 : 0);
        for (let i = 0; i < numLines; ++i) {
          lineNumbers[lineIndex] = highlightLines.has(lineIndex);
          if (i < numLines - 1) ++lineIndex;
        }
      } else {
        lineNumbers[lineIndex] = highlightLines.has(lineIndex);
      }
    }

    return lineNumbers;
  }

  return undefined;
}

export default function MarkdownCodeBlock({
  children,
  className,
  language,
  showLineNumbers,
  highlightLines,
}: MarkdownCodeBlockProps) {
  const plainText = React.useMemo(
    () => extractPlainText(children).trimEnd(),
    [children],
  );
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef<number | null>(null);

  const handleCopy = React.useCallback(() => {
    if (!plainText) return;
    void navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    });
  }, [plainText]);
  React.useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const languageLabel = formatLanguageLabel(language);
  const mergedClassName = cn(
    className?.includes("hljs") ? className : cn("hljs", className),
    "ls-code-block !pe-10",
  );

  const lineNumbers = showLineNumbers
    ? computeLineNumbers(children, highlightLines)
    : undefined;

  return (
    <span className="markdown-code-block group relative block">
      {languageLabel && (
        <span className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-full bg-background/50 px-2 py-0.5 text-xs uppercase text-foreground opacity-0 shadow ring-1 ring-border backdrop-blur-xs transition duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
          {languageLabel}
        </span>
      )}
      <button
        type="button"
        className="absolute top-3 right-3 z-10 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-background/50 text-primary/50 shadow ring-1 ring-border backdrop-blur-xs transition-all duration-200 hover:bg-background/70 hover:text-primary"
        onClick={handleCopy}
        aria-label={copied ? "已复制代码" : "复制代码"}
        title={copied ? "已复制" : "复制代码"}
      >
        {copied ? (
          <Check className="size-3" aria-hidden="true" />
        ) : (
          <Copy className="size-3" aria-hidden="true" />
        )}
      </button>
      <span className="pointer-events-none absolute inset-0 m-0 my-[1em] overflow-hidden rounded-xl font-mono text-sm">
        {[...highlightLines].map((lineNumber) => (
          <span
            key={lineNumber}
            className="absolute right-0 left-0 block h-[20px] bg-gray-500/10"
            style={{
              top: `calc(20px * ${String(lineNumber - 1)} + 1px)`,
              left: "1px",
              right: "1px",
            }}
          />
        ))}
      </span>
      <pre className="m-0 flex overflow-hidden rounded-xl font-mono">
        {lineNumbers ? (
          <code
            className="ls-code-block-line-numbers block border-e-[1px] border-border py-[1em]"
            aria-hidden="true"
          >
            {Object.keys(lineNumbers).map((lineNumber) => (
              <span
                key={lineNumber}
                className="block px-2 text-right text-sm text-muted-foreground/60 select-none"
              >
                {lineNumber}
              </span>
            ))}
          </code>
        ) : null}
        <code className={mergedClassName}>{children}</code>
      </pre>
    </span>
  );
}
