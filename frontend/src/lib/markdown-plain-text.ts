import { renderToString as renderKatex } from "katex";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";

import remarkLuoguFlavor from "../../vendor/remark-lda-lfm/index.js";

/**
 * 移植自原版 apps/web/lib/markdown-plain-text.ts。
 *
 * 把洛谷方言 Markdown 渲染成纯文本（保留可读文字，剥掉格式/链接/图片/媒体），
 * 用于推荐卡与信息流卡的正文摘要。
 */

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "list",
  "listItem",
  "table",
  "tableRow",
  "tableCell",
  "thematicBreak",
  "definition",
]);

type MdNode = {
  type?: string;
  value?: unknown;
  children?: MdNode[];
};

export function renderMarkdownToPlainText(markdown: string): string {
  const processor = unified().use(remarkParse).use(remarkMath).use(remarkLuoguFlavor);
  const tree = processor.parse(markdown ?? "");
  const transformed = processor.runSync(tree) as unknown as MdNode;

  const raw = flattenText(transformed);
  const normalized = raw.replace(/\s+/g, " ");
  // 去掉行内 directive 兜底文本前的多余空格
  return normalized.replace(/\s+([:;,!?])/g, "$1").trim();
}

function flattenText(node: MdNode | undefined, parts: string[] = []): string {
  switch (node?.type) {
    case "text":
    case "inlineCode":
    case "code": {
      if (typeof node.value === "string") parts.push(node.value);
      break;
    }
    case "inlineMath":
    case "math": {
      if (typeof node.value === "string") parts.push(renderLatexToText(node.value));
      break;
    }
    case "break": {
      parts.push(" ");
      break;
    }
    default: {
      if (Array.isArray(node?.children)) {
        for (const child of node.children) flattenText(child, parts);
        if (node.type !== undefined && BLOCK_TYPES.has(node.type)) parts.push(" ");
      }
    }
  }

  return parts.join(" ");
}

function renderLatexToText(latex: string): string {
  try {
    const mathml = renderKatex(latex, {
      output: "mathml",
      throwOnError: false,
      strict: "ignore",
    });
    const withoutAnnotation = mathml.replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/gi, " ");
    const stripped = withoutAnnotation.replace(/<[^>]+>/g, " ");
    return decodeEntities(stripped).replace(/\s+/g, " ").trim();
  } catch {
    return latex;
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}
