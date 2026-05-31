import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

/**
 * One row per competitor app found by the Scout workflow. `id` is the unified,
 * source-prefixed key (e.g. `ios-284910350`, `play-com.todoist`) so the same
 * app from overlapping keywords dedupes on upsert. `runId` ties a row to the
 * workflow instance that produced it; `compatibilityScore`/`rationale` are
 * filled by the ranking step (null until ranked). `platforms` is a JSON array.
 */
export const competitors = sqliteTable("competitors", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  name: text("name").notNull(),
  developer: text("developer"),
  description: text("description"),
  url: text("url"),
  source: text("source").notNull(),
  category: text("category"),
  platforms: text("platforms"),
  price: text("price"),
  iconUrl: text("icon_url"),
  launchedAt: text("launched_at"),
  rating: real("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  compatibilityScore: real("compatibility_score"),
  rationale: text("rationale"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

export type CompetitorRow = typeof competitors.$inferSelect;
export type CompetitorInsert = typeof competitors.$inferInsert;

/**
 * One row per search-intent expansion: the raw user query plus the LLM-derived
 * `keywords` and `categories` (each JSON-serialized as a string[]). Downstream
 * services (e.g. scout) read these to fan out searches across sources.
 */
export const searchExpansions = sqliteTable("search_expansions", {
  id: text("id").primaryKey(),
  query: text("query").notNull(),
  locale: text("locale"),
  /** JSON-serialized string[]. */
  keywords: text("keywords").notNull(),
  /** JSON-serialized string[]. */
  categories: text("categories").notNull(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export type SearchExpansionRow = typeof searchExpansions.$inferSelect;
export type SearchExpansionInsert = typeof searchExpansions.$inferInsert;

/**
 * One row per generated Global Digest snapshot (M6). The full `GlobalDigest`
 * object is stored JSON-serialized in `data`; `kind` keeps room for different
 * digest flavors. Produced on a Cloudflare Cron schedule, read latest-first.
 */
export const digests = sqliteTable("digests", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull().default("global"),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export type DigestRow = typeof digests.$inferSelect;
export type DigestInsert = typeof digests.$inferInsert;

/**
 * Time-series of App Store chart positions — one row per (app, country, feed,
 * day). Captured on every digest/Cron run so we can compute REAL rank momentum
 * (rising/falling) from observed movement instead of a one-shot heuristic.
 * `id` = `${appId}:${country}:${feed}:${capturedOn}` → one row per app/market/
 * feed/day (re-runs the same day are no-ops, keeping the first capture).
 */
export const chartSnapshots = sqliteTable(
  "chart_snapshots",
  {
    id: text("id").primaryKey(),
    appId: text("app_id").notNull(),
    name: text("name").notNull(),
    country: text("country").notNull(),
    feed: text("feed").notNull(),
    rank: integer("rank").notNull(),
    /** YYYY-MM-DD (UTC) the snapshot was captured. */
    capturedOn: text("captured_on").notNull(),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  },
  (t) => [index("idx_chart_snap_app_feed").on(t.appId, t.feed)],
);

export type ChartSnapshotRow = typeof chartSnapshots.$inferSelect;
export type ChartSnapshotInsert = typeof chartSnapshots.$inferInsert;
