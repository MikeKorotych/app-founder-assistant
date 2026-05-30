import type { RawCompetitor } from "./types.js";

/**
 * Dedupe by the unified `id` (source-prefixed). The same app surfaced by
 * overlapping keywords collapses to one entry — we keep the richest copy
 * (longest description) and the higher rating/review counts.
 */
export function dedupeById(items: RawCompetitor[]): RawCompetitor[] {
  const byId = new Map<string, RawCompetitor>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    byId.set(item.id, {
      ...existing,
      description:
        (item.description?.length ?? 0) > (existing.description?.length ?? 0)
          ? item.description
          : existing.description,
      rating: Math.max(existing.rating, item.rating),
      reviewCount: Math.max(existing.reviewCount, item.reviewCount),
    });
  }
  return [...byId.values()];
}
