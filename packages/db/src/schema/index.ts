import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * One row per pipeline run. The full `Run` object (from `@hahaton/contracts`)
 * is stored JSON-serialized in `data` so a completed run replays instantly —
 * the demo safety net. `id`/`status` are mirrored as columns for cheap lookups.
 */
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

export type RunRow = typeof runs.$inferSelect;
export type RunInsert = typeof runs.$inferInsert;
