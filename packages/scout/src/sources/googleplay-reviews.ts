import type { Review } from "@hahaton/contracts";

/**
 * Google Play reviews via SerpApi's `google_play_product` engine (keyed by
 * GOOGLE_SEARCH_API_KEY). No key → returns []. SerpApi field names vary, so we
 * map defensively. Never throws — a failed call degrades to [].
 */

interface SerpReview {
  id?: string;
  title?: string;
  snippet?: string;
  text?: string;
  rating?: number;
  author?: string;
  name?: string;
  date?: string;
  iso_date?: string;
}

export async function fetchGooglePlayReviews(
  packageName: string,
  competitorId: string,
  apiKey: string | undefined,
  opts: { country?: string; max?: number } = {},
): Promise<Review[]> {
  if (!apiKey) return [];
  const num = Math.min(opts.max ?? 40, 199);
  const country = opts.country ?? "us";
  try {
    const url = `https://serpapi.com/search.json?engine=google_play_product&product_id=${encodeURIComponent(packageName)}&store=apps&all_reviews=true&num=${num}&gl=${country}&api_key=${apiKey}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const body = (await res.json()) as { reviews?: SerpReview[] };
    const raw = Array.isArray(body.reviews) ? body.reviews : [];
    const out: Review[] = [];
    for (const [i, r] of raw.entries()) {
      const text = (r.snippet ?? r.text ?? "").trim();
      if (!text) continue;
      out.push({
        id: r.id ? `${competitorId}#${r.id}` : `${competitorId}#gp-${i}`,
        competitorId,
        source: "googleplay",
        rating: typeof r.rating === "number" && r.rating > 0 ? r.rating : undefined,
        title: r.title,
        body: text,
        author: r.author ?? r.name,
        at: r.iso_date ?? r.date,
      });
    }
    return out;
  } catch {
    return [];
  }
}
