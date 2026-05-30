import { dedupeById } from "../normalize.js";
import type { RawCompetitor, ScoutParams } from "../types.js";

/**
 * iTunes Search API — no auth. One GET per keyword, results merged + deduped.
 * Docs: https://itunes.apple.com/search?term=&media=software&entity=software
 */
const ENDPOINT = "https://itunes.apple.com/search";

interface ItunesResult {
  trackId?: number;
  trackName?: string;
  description?: string;
  primaryGenreName?: string;
  sellerName?: string;
  artistName?: string;
  formattedPrice?: string;
  trackViewUrl?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  // Apple returns artwork in several sizes; we keep the smallest available.
  artworkUrl60?: string;
  artworkUrl100?: string;
  artworkUrl512?: string;
}

function toCompetitor(r: ItunesResult): RawCompetitor | null {
  if (!r.trackId || !r.trackName) return null;
  return {
    id: `ios-${r.trackId}`,
    name: r.trackName,
    source: "itunes",
    description: r.description,
    url: r.trackViewUrl,
    developer: r.sellerName ?? r.artistName,
    category: r.primaryGenreName,
    platforms: ["ios"],
    price: r.formattedPrice,
    iconUrl: r.artworkUrl60 ?? r.artworkUrl100 ?? r.artworkUrl512,
    rating: r.averageUserRating ?? 0,
    reviewCount: r.userRatingCount ?? 0,
  };
}

export async function fetchItunes(params: ScoutParams, country: string): Promise<RawCompetitor[]> {
  const limit = params.limitPerSource ?? 15;
  // Per-keyword, settle independently: one failing term (iTunes intermittently
  // 4xx's a single query from the Workers egress) must NOT discard the results
  // the other terms returned. Only when *every* term fails do we throw, so the
  // workflow step can still retry/degrade the source as a whole.
  const settled = await Promise.allSettled(
    params.keywords.map(async (term) => {
      const url = `${ENDPOINT}?term=${encodeURIComponent(term)}&media=software&entity=software&country=${country}&limit=${limit}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`iTunes ${res.status} for "${term}"`);
      const body = (await res.json()) as { results?: ItunesResult[] };
      return (body.results ?? []).map(toCompetitor).filter((c): c is RawCompetitor => c !== null);
    }),
  );
  const ok = settled.filter(
    (r): r is PromiseFulfilledResult<RawCompetitor[]> => r.status === "fulfilled",
  );
  if (ok.length === 0 && settled.length > 0) {
    const first = settled[0] as PromiseRejectedResult;
    throw first.reason instanceof Error
      ? first.reason
      : new Error(`iTunes: all keyword queries failed (${String(first.reason)})`);
  }
  return dedupeById(ok.flatMap((r) => r.value));
}
