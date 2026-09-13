import { drizzle } from "drizzle-orm/d1";

import type { Env } from "../env.js";
import * as schema from "./schema.js";

export * from "drizzle-orm";
export { schema };

export function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
