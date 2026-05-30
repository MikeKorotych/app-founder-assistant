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
    rating: r.averageUserRating ?? 0,
    reviewCount: r.userRatingCount ?? 0,
  };
}

export async function fetchItunes(params: ScoutParams, country: string): Promise<RawCompetitor[]> {
  const limit = params.limitPerSource ?? 15;
  const perKeyword = await Promise.all(
    params.keywords.map(async (term) => {
      const url = `${ENDPOINT}?term=${encodeURIComponent(term)}&media=software&entity=software&country=${country}&limit=${limit}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`iTunes ${res.status} for "${term}"`);
      const body = (await res.json()) as { results?: ItunesResult[] };
      return (body.results ?? []).map(toCompetitor).filter((c): c is RawCompetitor => c !== null);
    }),
  );
  return dedupeById(perKeyword.flat());
}
