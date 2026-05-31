import type { Review } from "@hahaton/contracts";
import { fetchGooglePlayReviews } from "./sources/googleplay-reviews.js";
import { fetchItunesReviews } from "./sources/itunes-reviews.js";
import type { RawCompetitor, SourceId } from "./types.js";

/**
 * Collect reviews for the top discovered competitors.
 *
 * NOTE: a competitor's `id` is `${prefix}-${externalId}` where the prefix
 * DIFFERS from its `source` — itunes → "ios-", googleplay → "play-". We strip
 * that prefix to recover the store id (iTunes trackId / Play package name).
 * Resilient (Promise.allSettled): one competitor failing never sinks the rest.
 */
const ID_PREFIX: Partial<Record<SourceId, string>> = { itunes: "ios-", googleplay: "play-" };

function externalId(c: RawCompetitor): string | null {
  const prefix = ID_PREFIX[c.source];
  if (!prefix || !c.id.startsWith(prefix)) return null;
  return c.id.slice(prefix.length);
}

export interface CollectReviewsOpts {
  searchApiKey?: string;
  country?: string;
  /** How many top competitors (by review count) to mine. Default 5. */
  topN?: number;
  /** Cap per competitor. Default 40. */
  perCompetitor?: number;
  /** Overall cap. Default 150. */
  maxTotal?: number;
}

export async function collectReviews(
  competitors: RawCompetitor[],
  opts: CollectReviewsOpts = {},
): Promise<Review[]> {
  const topN = opts.topN ?? 5;
  const perCompetitor = opts.perCompetitor ?? 40;
  const maxTotal = opts.maxTotal ?? 150;

  const candidates = competitors
    .filter((c) => c.source === "itunes" || c.source === "googleplay")
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, topN);

  const settled = await Promise.allSettled(
    candidates.map(async (c) => {
      const ext = externalId(c);
      if (!ext) return [] as Review[];
      const reviews =
        c.source === "itunes"
          ? await fetchItunesReviews(ext, c.id, { country: opts.country })
          : await fetchGooglePlayReviews(ext, c.id, opts.searchApiKey, { country: opts.country });
      return reviews.slice(0, perCompetitor);
    }),
  );

  const all = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return all.slice(0, maxTotal);
}
