import { handle } from "hono/cloudflare-pages";

import { app } from "../../src/app.js";

// Pages Functions 的 catch-all：所有 /api/* 请求交给同一个 Hono 应用处理。
// 静态前端由 Pages 直接托管（dist/），不会被此函数拦截。
export const onRequest = handle(app);
