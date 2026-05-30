import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema/index";

/**
 * D1 binding handle. Typed from drizzle's own signature so this package needs
 * no ambient `@cloudflare/workers-types`, and any consumer (Worker or plain
 * lib) can compile it. The Worker's `c.env.DB` is structurally compatible.
 */
type D1 = Parameters<typeof drizzle>[0];

/** Build a Drizzle client over the Worker's D1 binding (`c.env.DB`). */
export function createDb(d1: D1) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;
