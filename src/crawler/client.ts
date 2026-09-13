import type { Env } from "../env.js";
import { requestLentille } from "./http.js";
import type { LentilleEnvelope } from "./lentille.js";
import { buildPath, type RouteName } from "./routes.js";

export interface RequestOptions {
  params?: Record<string, string | number>;
  query?: Record<string, string | number | undefined>;
}

/**
 * 按命名路由请求洛谷并返回归一化后的 lentille 数据。
 * 对标原项目 `clientLentille.get("discuss.show", { params, query })`。
 */
export function getLentille(
  route: RouteName,
  options: RequestOptions,
  env: Env,
): Promise<LentilleEnvelope> {
  const path = buildPath(route, options.params ?? {});
  return requestLentille(path, options.query ?? {}, env);
}
