import type { Review } from "@hahaton/contracts";

/**
 * App Store customer reviews via the public iTunes RSS JSON feed — no auth.
 * `…/{country}/rss/customerreviews/page={p}/id={trackId}/sortby=mostrecent/json`
 * returns up to 50 reviews/page, ~10 pages. The first entry on page 1 is the app
 * metadata (not a review) and is skipped. Resilient: a failed/empty page stops
 * paging and returns whatever was collected — never throws on a single bad page.
 */

interface RssEntry {
  id?: { label?: string };
  "im:rating"?: { label?: string };
  title?: { label?: string };
  content?: { label?: string };
  author?: { name?: { label?: string } };
}

export async function fetchItunesReviews(
  trackId: string,
  competitorId: string,
  opts: { country?: string; maxPages?: number } = {},
): Promise<Review[]> {
  const country = opts.country ?? "us";
  const maxPages = Math.min(opts.maxPages ?? 3, 10);
  const out: Review[] = [];

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${trackId}/sortby=mostrecent/json`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) break;
      const body = (await res.json()) as { feed?: { entry?: RssEntry | RssEntry[] } };
      const raw = body.feed?.entry;
      if (!raw) break;
      const entries = Array.isArray(raw) ? raw : [raw];
      // First entry on page 1 is app metadata, not a review.
      const reviews = page === 1 ? entries.slice(1) : entries;
      if (reviews.length === 0) break;
      for (const [i, e] of reviews.entries()) {
        const text = e.content?.label?.trim();
        if (!text) continue;
        const ratingNum = Number(e["im:rating"]?.label);
        out.push({
          id: e.id?.label ? `${competitorId}#${e.id.label}` : `${competitorId}#p${page}-${i}`,
          competitorId,
          source: "itunes",
          rating: Number.isFinite(ratingNum) && ratingNum > 0 ? ratingNum : undefined,
          title: e.title?.label,
          body: text,
          author: e.author?.name?.label,
        });
      }
    } catch {
      break;
    }
  }
  return out;
}
