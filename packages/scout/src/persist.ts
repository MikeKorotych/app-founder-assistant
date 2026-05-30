import { competitors, type Db } from "@hahaton/db";
import { desc, eq } from "drizzle-orm";
import type { RawCompetitor } from "./types.js";

const nowIso = () => new Date().toISOString();

/**
 * Upsert discovered competitors for a workflow run. `id` is the conflict target,
 * so a re-run with overlapping apps updates rather than duplicates. D1 caps bound
 * variables, so we chunk the batch. Ranking was removed — every discovered app is
 * persisted as-is (compatibilityScore/rationale left null) and shown on the UI.
 */
export async function persistCompetitors(
  db: Db,
  runId: string,
  discovered: RawCompetitor[],
): Promise<void> {
  if (discovered.length === 0) return;
  const rows = discovered.map((c) => ({
    id: c.id,
    runId,
    name: c.name,
    developer: c.developer ?? null,
    description: c.description ?? null,
    url: c.url ?? null,
    source: c.source,
    category: c.category ?? null,
    platforms: JSON.stringify(c.platforms),
    price: c.price ?? null,
    rating: c.rating,
    reviewCount: c.reviewCount,
    compatibilityScore: null,
    rationale: null,
    updatedAt: nowIso(),
  }));

  const CHUNK = 20;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await db.batch(
      chunk.map((row) =>
        db
          .insert(competitors)
          .values(row)
          .onConflictDoUpdate({
            target: competitors.id,
            set: {
              runId: row.runId,
              name: row.name,
              developer: row.developer,
              description: row.description,
              url: row.url,
              category: row.category,
              platforms: row.platforms,
              price: row.price,
              rating: row.rating,
              reviewCount: row.reviewCount,
              compatibilityScore: row.compatibilityScore,
              rationale: row.rationale,
              updatedAt: row.updatedAt,
            },
          }),
      ) as unknown as Parameters<Db["batch"]>[0],
    );
  }
}

/** Read back a run's competitors, most-reviewed (most popular) first. */
export async function listCompetitors(db: Db, runId: string) {
  return db
    .select()
    .from(competitors)
    .where(eq(competitors.runId, runId))
    .orderBy(desc(competitors.reviewCount), desc(competitors.rating));
}
