/**
 * 洛谷路由表：把「命名路由」映射到实际路径。
 *
 * 原项目用 @lgjs/request 的 `client.get("discuss.show", { params: { id } })`，
 * 该依赖未随仓库提供，这里自建等价的最小路由表。
 */

export type RouteName = "discuss.show" | "discuss.list";

interface RouteDef {
  path: string;
}

const ROUTES: Record<RouteName, RouteDef> = {
  // 详情：GET /discuss/{id}?page=N
  "discuss.show": { path: "/discuss/{id}" },
  // 列表：GET /discuss?forum=xxx&page=N
  "discuss.list": { path: "/discuss" },
};

export function buildPath(
  route: RouteName,
  params: Record<string, string | number> = {},
): string {
  let path: string = ROUTES[route].path;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
  }
  return path;
}

export function buildUrl(
  base: string,
  path: string,
  query: Record<string, string | number | undefined | null> = {},
): string {
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}
