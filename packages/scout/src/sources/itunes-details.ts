import type { AppStoreDetails } from "@hahaton/contracts";

/**
 * Real App Store metadata via the public iTunes Lookup API — no auth, batched
 * (up to ~50 ids per call). Returns a map keyed by appId (iTunes trackId).
 * Resilient: a failed batch is skipped, never throws. Apple does NOT expose
 * download counts — only reviews/rating/release date/screenshots/description.
 */

interface LookupResult {
  trackId?: number;
  artworkUrl512?: string;
  artworkUrl100?: string;
  description?: string;
  screenshotUrls?: string[];
  releaseDate?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  primaryGenreName?: string;
  formattedPrice?: string;
}

export async function fetchItunesAppDetails(
  appIds: string[],
  opts: { country?: string } = {},
): Promise<Map<string, AppStoreDetails>> {
  const out = new Map<string, AppStoreDetails>();
  const ids = [...new Set(appIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const country = opts.country ?? "us";

  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    try {
      const url = `https://itunes.apple.com/lookup?id=${batch.join(",")}&country=${country}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const body = (await res.json()) as { results?: LookupResult[] };
      for (const r of body.results ?? []) {
        if (!r.trackId) continue;
        out.set(String(r.trackId), {
          appId: String(r.trackId),
          iconUrl: r.artworkUrl512 ?? r.artworkUrl100,
          description: r.description,
          screenshots: Array.isArray(r.screenshotUrls) ? r.screenshotUrls.slice(0, 8) : undefined,
          releaseDate: r.releaseDate,
          rating: typeof r.averageUserRating === "number" ? r.averageUserRating : undefined,
          reviewCount: typeof r.userRatingCount === "number" ? r.userRatingCount : undefined,
          genre: r.primaryGenreName,
          price: r.formattedPrice,
        });
      }
    } catch {
      // skip this batch
    }
  }
  return out;
}
