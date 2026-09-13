import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { Link } from "../App";
import { cn } from "../lib/utils";
import "katex/dist/katex.min.css";
import "./markdown.css";
import "./highlight.css";

export function renderMarkdownToPlainText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " [代码] ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`~_[\]-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function Markdown({
  children,
  compact = false,
}: {
  children: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("markdown-body", compact ? "markdown-body-compact" : "")}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        skipHtml
        components={{
          p(props) {
            const { children, className, ...rest } = props;
            return (
              <div className={cn(className, "fake-p")} {...rest}>
                {children}
              </div>
            );
          },
          a(props) {
            const { children, href } = props;
            const external = typeof href === "string" && /^https?:\/\//.test(href);
            const userMatch =
              typeof href === "string" ? /^\/?user\/(\d+)$/.exec(href) : null;
            if (userMatch) {
              return <Link href={`/u/${userMatch[1] ?? ""}`}>{children}</Link>;
            }
            return (
              <a
                href={href ?? "#"}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
