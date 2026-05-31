import type { ChartApp, GlobalDigest, RankHistory, Run, SearchExpansion } from "@hahaton/contracts";
import { chartSnapshots, type Db, digests, runs, searchExpansions } from "@hahaton/db";
import { and, desc, eq, inArray } from "drizzle-orm";

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

// ---------------------------------------------------------------------------
// Global Digest (M6)
// ---------------------------------------------------------------------------

/** Persist a generated Global Digest snapshot (full JSON in `data`). */
export async function saveDigest(db: Db, digest: GlobalDigest, kind = "global"): Promise<void> {
  await db.insert(digests).values({ id: digest.id, kind, data: JSON.stringify(digest) });
}

/** Load the most recent digest of a kind (the cron writes; the UI reads). */
export async function loadLatestDigest(db: Db, kind = "global"): Promise<GlobalDigest | null> {
  const [row] = await db
    .select()
    .from(digests)
    .where(eq(digests.kind, kind))
    .orderBy(desc(digests.createdAt))
    .limit(1);
  if (!row) return null;
  return JSON.parse(row.data) as GlobalDigest;
}

// ---------------------------------------------------------------------------
// Chart time-series (real rank momentum)
// ---------------------------------------------------------------------------

/** Positions of rank improvement/decline that count as a real trend (vs noise). */
const TREND_THRESHOLD = 3;

/**
 * Pure aggregation: collapse one app's raw snapshots into a RankHistory.
 * Uses the BEST (lowest) rank per day across markets as that day's position.
 * Exported for unit testing without a database.
 */
export function summarizeRankHistory(
  appId: string,
  rows: Array<{ capturedOn: string; rank: number }>,
): RankHistory | null {
  if (rows.length === 0) return null;
  const bestByDay = new Map<string, number>();
  for (const r of rows) {
    const cur = bestByDay.get(r.capturedOn);
    if (cur == null || r.rank < cur) bestByDay.set(r.capturedOn, r.rank);
  }
  const days = [...bestByDay.keys()].sort();
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const firstBestRank = bestByDay.get(firstDay) as number;
  const currentBestRank = bestByDay.get(lastDay) as number;
  const peakRank = Math.min(...bestByDay.values());
  const rankDelta = firstBestRank - currentBestRank; // + = climbed up
  let trend: RankHistory["trend"];
  if (days.length < 2) trend = "new";
  else if (rankDelta >= TREND_THRESHOLD) trend = "rising";
  else if (rankDelta <= -TREND_THRESHOLD) trend = "falling";
  else trend = "flat";
  return {
    appId,
    daysTracked: days.length,
    firstDay,
    lastDay,
    firstBestRank,
    currentBestRank,
    peakRank,
    rankDelta,
    trend,
  };
}

/**
 * Persist a chart capture as the time-series feeding real momentum. One row per
 * (app, country, feed, day); the in-memory pass keeps the best rank per market
 * for this run, and same-day re-runs are no-ops (first capture wins). Chunked
 * to stay under SQLite's bound-parameter limit.
 */
export async function saveChartSnapshots(
  db: Db,
  charts: ChartApp[],
  feed: string,
  capturedOn: string,
): Promise<void> {
  if (charts.length === 0) return;
  const byKey = new Map<string, (typeof chartSnapshots)["$inferInsert"]>();
  for (const c of charts) {
    const id = `${c.appId}:${c.country}:${feed}:${capturedOn}`;
    const prev = byKey.get(id);
    if (!prev || c.rank < prev.rank) {
      byKey.set(id, {
        id,
        appId: c.appId,
        name: c.name,
        country: c.country,
        feed,
        rank: c.rank,
        capturedOn,
      });
    }
  }
  const rows = [...byKey.values()];
  for (let i = 0; i < rows.length; i += 100) {
    await db
      .insert(chartSnapshots)
      .values(rows.slice(i, i + 100))
      .onConflictDoNothing();
  }
}

/**
 * Build RankHistory for the given apps from accumulated snapshots in one feed.
 * Returns a map keyed by appId (apps with no history are simply absent).
 */
export async function getRankHistory(
  db: Db,
  appIds: string[],
  feed: string,
): Promise<Map<string, RankHistory>> {
  const out = new Map<string, RankHistory>();
  const ids = [...new Set(appIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const rows = await db
    .select({
      appId: chartSnapshots.appId,
      rank: chartSnapshots.rank,
      capturedOn: chartSnapshots.capturedOn,
    })
    .from(chartSnapshots)
    .where(and(eq(chartSnapshots.feed, feed), inArray(chartSnapshots.appId, ids)));
  const byApp = new Map<string, Array<{ capturedOn: string; rank: number }>>();
  for (const r of rows) {
    const list = byApp.get(r.appId);
    if (list) list.push({ capturedOn: r.capturedOn, rank: r.rank });
    else byApp.set(r.appId, [{ capturedOn: r.capturedOn, rank: r.rank }]);
  }
  for (const [appId, rs] of byApp) {
    const h = summarizeRankHistory(appId, rs);
    if (h) out.set(appId, h);
  }
  return out;
}
