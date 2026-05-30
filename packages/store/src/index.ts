import type { Run, SearchExpansion } from "@hahaton/contracts";
import { type Db, runs, searchExpansions } from "@hahaton/db";
import { desc, eq } from "drizzle-orm";

/**
 * D1-backed persistence for runs — the demo replay safety net. A completed run
 * is upserted as a single row (full JSON in `data`) so it reloads + replays
 * instantly on stage. Pass the Drizzle handle from the Worker: `createDb(c.env.DB)`.
 */
const nowIso = () => new Date().toISOString();

export async function saveRun(db: Db, run: Run): Promise<void> {
  const data = JSON.stringify(run);
  await db
    .insert(runs)
    .values({ id: run.id, status: run.status, data, updatedAt: nowIso() })
    .onConflictDoUpdate({
      target: runs.id,
      set: { status: run.status, data, updatedAt: nowIso() },
    });
}

export async function loadRun(db: Db, id: string): Promise<Run | null> {
  const [row] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  if (!row) return null;
  return JSON.parse(row.data) as Run;
}

// ---------------------------------------------------------------------------
// Search-intent expansions
// ---------------------------------------------------------------------------

type SearchExpansionRow = typeof searchExpansions.$inferSelect;

function rowToExpansion(row: SearchExpansionRow): SearchExpansion {
  return {
    id: row.id,
    query: row.query,
    locale: row.locale ?? undefined,
    keywords: JSON.parse(row.keywords) as string[],
    categories: JSON.parse(row.categories) as string[],
    createdAt: row.createdAt,
  };
}

/** Upsert a search-intent expansion (keywords/categories stored as JSON). */
export async function saveSearchExpansion(db: Db, e: SearchExpansion): Promise<void> {
  const values = {
    id: e.id,
    query: e.query,
    locale: e.locale ?? null,
    keywords: JSON.stringify(e.keywords),
    categories: JSON.stringify(e.categories),
    createdAt: e.createdAt,
  };
  await db
    .insert(searchExpansions)
    .values(values)
    .onConflictDoUpdate({
      target: searchExpansions.id,
      set: {
        query: values.query,
        locale: values.locale,
        keywords: values.keywords,
        categories: values.categories,
      },
    });
}

export async function loadSearchExpansion(db: Db, id: string): Promise<SearchExpansion | null> {
  const [row] = await db
    .select()
    .from(searchExpansions)
    .where(eq(searchExpansions.id, id))
    .limit(1);
  if (!row) return null;
  return rowToExpansion(row);
}

/** Most recent expansions first — handy for a UI history list. */
export async function listSearchExpansions(db: Db, limit = 20): Promise<SearchExpansion[]> {
  const rows = await db
    .select()
    .from(searchExpansions)
    .orderBy(desc(searchExpansions.createdAt))
    .limit(limit);
  return rows.map(rowToExpansion);
}
