import { defineConfig } from "drizzle-kit";

// 仅用于按 schema 生成 SQL 参考（`npm run db:generate`）。
// 实际把迁移应用到 D1 走 `wrangler d1 migrations apply`（migrations/*.sql）。
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./migrations",
});
