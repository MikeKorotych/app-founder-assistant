import { dedupeById } from "../normalize.js";
import type { RawCompetitor, ScoutParams } from "../types.js";

/**
 * Google Play has no official public search API, and the `google-play-scraper`
 * npm lib doesn't run on the Workers runtime. So we go through a SERP provider
 * (SerpApi's `google_play` engine) keyed by `GOOGLE_SEARCH_API_KEY`. If no key is set,
 * this source degrades to empty (the run still works on the other sources).
 *
 * SerpApi: GET https://serpapi.com/search.json?engine=google_play&store=apps&q=&api_key=
 */
const ENDPOINT = "https://serpapi.com/search.json";

interface SerpApiApp {
  product_id?: string;
  title?: string;
  description?: string;
  link?: string;
  developer?: string;
  category?: string;
  rating?: number;
  reviews?: number;
  price?: string;
  free?: boolean;
}

function toCompetitor(a: SerpApiApp): RawCompetitor | null {
  if (!a.product_id || !a.title) return null;
  return {
    id: `play-${a.product_id}`,
    name: a.title,
    source: "googleplay",
    description: a.description,
    url: a.link ?? `https://play.google.com/store/apps/details?id=${a.product_id}`,
    developer: a.developer,
    category: a.category,
    platforms: ["android"],
    price: a.free ? "Free" : a.price,
    rating: a.rating ?? 0,
    reviewCount: a.reviews ?? 0,
  };
}

/** Flatten SerpApi's `organic_results` (which may be sectioned) into apps. */
function extractApps(body: Record<string, unknown>): SerpApiApp[] {
  const organic = body.organic_results;
  if (!Array.isArray(organic)) return [];
  return organic.flatMap((section) => {
    if (
      section &&
      typeof section === "object" &&
      Array.isArray((section as { items?: unknown }).items)
    ) {
      return (section as { items: SerpApiApp[] }).items;
    }
    return [section as SerpApiApp];
  });
}

export async function fetchGooglePlay(
  params: ScoutParams,
  apiKey: string | undefined,
  country: string,
): Promise<RawCompetitor[]> {
  if (!apiKey) return [];
  // Settle per keyword so one failing term doesn't discard the rest (mirrors
  // iTunes). Throw only when every term failed → the step retries/degrades.
  const settled = await Promise.allSettled(
    params.keywords.map(async (term) => {
      const url = `${ENDPOINT}?engine=google_play&store=apps&gl=${country}&q=${encodeURIComponent(term)}&api_key=${apiKey}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Google Play (SERP) ${res.status} for "${term}"`);
      const body = (await res.json()) as Record<string, unknown>;
      return extractApps(body)
        .map(toCompetitor)
        .filter((c): c is RawCompetitor => c !== null);
    }),
  );
  const ok = settled.filter(
    (r): r is PromiseFulfilledResult<RawCompetitor[]> => r.status === "fulfilled",
  );
  if (ok.length === 0 && settled.length > 0) {
    const first = settled[0] as PromiseRejectedResult;
    throw first.reason instanceof Error
      ? first.reason
      : new Error(`Google Play: all keyword queries failed (${String(first.reason)})`);
  }
  return dedupeById(ok.flatMap((r) => r.value));
}
