/**
 * 洛谷 HTTP 取数层（Cloudflare Workers 版）。
 *
 * 取数约束：
 *   - `.com` 域同样架在 Cloudflare 上，Workers 出站会被 CF-to-CF 拦截 → 不可用；
 *   - `.com.cn` 域可从边缘带 cookie 抓取，返回 legacy HTML（内嵌 lentille 数据）；
 *   - 需要头 `x-luogu-type: content-only` + 小号 cookie（__client_id + _uid）。
 *
 * 网宿 C3VK CC 防护：
 *   - 触发时返回 302 且 Set-Cookie: C3VK=...；把该 cookie 拼进后续请求即可放行；
 *   - 边缘出口常直接 200 不触发，回环逻辑保留作兜底。
 */

import { AccessError, HttpError, UnexpectedStatusError } from "./errors.js";
import { extractLentilleEnvelope, type LentilleEnvelope } from "./lentille.js";
import { buildUrl } from "./routes.js";

export const LUOGU_BASE_URL = "https://www.luogu.com.cn";

const USER_AGENT =
  "LuoguDiscussSaver/0.1 (+https://github.com/SomeoneHX/luogu-discuss-saver)";

/** 网宿 C3VK 质询 cookie 缓存（模块级，供同一 isolate 内复用）。 */
let c3vk: string | null = null;

/** 上一次请求时间，用于单账号最小间隔闸门。 */
let lastRequestAt = 0;

export interface FetchEnv {
  LUOGU_COOKIE?: string;
  CRAWL_MIN_INTERVAL_MS?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 单账号请求间隔闸门。注意：模块级状态不跨 isolate，
 *  个人站单 isolate 足够；若要严格全局限流可升级到 Durable Object。 */
async function throttle(minIntervalMs: number): Promise<void> {
  const wait = lastRequestAt + minIntervalMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function buildCookieHeader(cookie?: string): string | undefined {
  const parts: string[] = [];
  if (cookie?.trim()) parts.push(cookie.trim());
  if (c3vk) parts.push(`C3VK=${c3vk}`);
  return parts.length ? parts.join("; ") : undefined;
}

async function requestOnce(
  url: string,
  cookie: string | undefined,
  minIntervalMs: number,
): Promise<Response> {
  await throttle(minIntervalMs);

  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    "x-luogu-type": "content-only",
    accept:
      "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "accept-language": "zh-CN,zh;q=0.9",
  };
  const cookieHeader = buildCookieHeader(cookie);
  if (cookieHeader) headers.cookie = cookieHeader;

  return fetch(url, { method: "GET", headers, redirect: "manual" });
}

function readSetCookies(res: Response): string[] {
  // Workers 运行时提供 getSetCookie()；旧运行时退化为单值。
  const anyHeaders = res.headers as unknown as {
    getSetCookie?: () => string[];
  };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function extractC3VK(res: Response): string | null {
  for (const raw of readSetCookies(res)) {
    const match = /(?:^|;\s*)C3VK=([^;,\s]+)/i.exec(raw);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * 请求一个洛谷路由并返回归一化后的 lentille 数据。
 */
export async function requestLentille(
  path: string,
  query: Record<string, string | number | undefined>,
  env: FetchEnv,
): Promise<LentilleEnvelope> {
  const url = buildUrl(LUOGU_BASE_URL, path, query);
  const minIntervalMs = Number(env.CRAWL_MIN_INTERVAL_MS ?? 6000);
  const cookie = env.LUOGU_COOKIE;

  let res = await requestOnce(url, cookie, minIntervalMs);

  // 网宿 CC 质询：3xx + Set-Cookie: C3VK → 记录后重试一次
  if (res.status >= 300 && res.status < 400) {
    const challenge = extractC3VK(res);
    if (challenge) {
      c3vk = challenge;
      res = await requestOnce(url, cookie, minIntervalMs);
    }
  }

  if (res.status === 403 || res.status === 404) {
    throw new AccessError(url, res.status);
  }
  if (res.status < 200 || res.status >= 300) {
    throw new UnexpectedStatusError("Unexpected status", url, res.status);
  }

  const body = await res.text();
  return extractLentilleEnvelope(body, url);
}

/** 供测试/调试：读取当前缓存的 C3VK。 */
export function peekC3VK(): string | null {
  return c3vk;
}

export { HttpError };
