/**
 * lentille 数据提取。
 *
 * 洛谷页面（含 discuss）会把服务端数据以 JSON 形式注入到
 * `<script id="lentille-context" type="application/json">…</script>` 中，
 * 这就是「lentille 接口」的数据来源。爬虫必须解析这份 JSON，
 * 而**不是**去遍历 HTML DOM。
 *
 * 两种可能的响应形态：
 *   A. 直接是应用层 JSON：{ status, data, time }         （content-only 直出）
 *   B. HTML 文档壳，内嵌 lentille-context：
 *      { code, currentData, currentTemplate, templateData } （legacy 页面）
 * 这里统一归一化为 { status, data, time }。
 */

import { ParseError } from "./errors.js";

export interface LentilleEnvelope {
  status: number;
  data: any;
  /** 服务器时间戳（Unix 秒），用于快照 capturedAt / time。 */
  time: number;
}

const LENTILLE_SCRIPT_RE =
  /<script[^>]*\bid=["']lentille-context["'][^>]*>([\s\S]*?)<\/script>/i;

const FE_INJECTION_RE = /window\._feInjection\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i;

export function extractLentilleEnvelope(
  body: string,
  url: string,
): LentilleEnvelope {
  const trimmed = body.trimStart();

  // 形态 A：content-only 直出 JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = safeJsonParse(trimmed);
    if (parsed !== undefined) return normalize(parsed, url);
  }

  // 形态 B：HTML 壳 → lentille-context
  const lentilleMatch = LENTILLE_SCRIPT_RE.exec(body);
  if (lentilleMatch?.[1]) {
    const parsed = safeJsonParse(unescapeHtml(lentilleMatch[1].trim()));
    if (parsed !== undefined) return normalize(parsed, url);
  }

  // 形态 B'：旧版 window._feInjection 兜底
  const feMatch = FE_INJECTION_RE.exec(body);
  if (feMatch?.[1]) {
    const parsed = safeJsonParse(feMatch[1]);
    if (parsed !== undefined) return normalize(parsed, url);
  }

  throw new ParseError(`无法从响应中提取 lentille 数据: ${url}`);
}

function normalize(parsed: any, url: string): LentilleEnvelope {
  if (!parsed || typeof parsed !== "object") {
    throw new ParseError(`lentille payload 不是对象: ${url}`);
  }

  // 形态 A：{ status, data, time }
  if ("data" in parsed && ("status" in parsed || "code" in parsed)) {
    const status = Number(parsed.status ?? parsed.code ?? 200);
    const time = Number(
      parsed.time ?? parsed.data?.time ?? Math.floor(Date.now() / 1000),
    );
    return { status, data: parsed.data, time };
  }

  // 形态 B：{ code, currentData, ... }
  if ("currentData" in parsed) {
    const data = parsed.currentData;
    const status = Number(parsed.code ?? 200);
    const time = Number(
      data?.time ?? data?.post?.time ?? Math.floor(Date.now() / 1000),
    );
    return { status, data, time };
  }

  throw new ParseError(`无法识别的 lentille payload 结构: ${url}`);
}

function safeJsonParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}
