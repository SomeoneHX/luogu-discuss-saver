/**
 * Hono 应用（与运行时无关），由 Pages Functions 的 catch-all 挂载：
 *   functions/api/[[path]].ts → handle(app)
 */

import { Hono } from "hono";

import { registerApi } from "./api/routes.js";
import type { Env } from "./env.js";

export const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) =>
  c.json({ name: "luogu-discuss-saver", status: "ok", scope: "discuss" }),
);

registerApi(app);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error("[http]", err);
  return c.json({ error: err.message }, 500);
});
