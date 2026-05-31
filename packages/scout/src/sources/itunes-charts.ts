import type { ChartApp } from "@hahaton/contracts";

/**
 * App Store top charts via the public iTunes RSS JSON feed — no auth, per country
 * and (optionally) per genre. Used by the Global Niche Radar to find apps that
 * chart in some markets but not the founder's home market. Never throws — a
 * failed/empty country degrades to [].
 *
 * `…/{country}/rss/{feed}/limit={n}[/genre={id}]/json`
 */

export type ChartFeed =
  | "topfreeapplications"
  | "newfreeapplications"
  | "topgrossingapplications"
  | "toppaidapplications";

interface ChartEntry {
  "im:name"?: { label?: string };
  "im:artist"?: { label?: string };
  id?: { label?: string; attributes?: { "im:id"?: string } };
  link?: { attributes?: { href?: string } } | Array<{ attributes?: { href?: string } }>;
}

export async function fetchItunesChart(
  country: string,
  opts: { genreId?: number; feed?: ChartFeed; limit?: number } = {},
): Promise<ChartApp[]> {
  const feed = opts.feed ?? "topfreeapplications";
  const limit = Math.min(opts.limit ?? 50, 100);
  const genre = opts.genreId ? `/genre=${opts.genreId}` : "";
  try {
    const url = `https://itunes.apple.com/${country}/rss/${feed}/limit=${limit}${genre}/json`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const body = (await res.json()) as { feed?: { entry?: ChartEntry | ChartEntry[] } };
    const raw = body.feed?.entry;
    if (!raw) return [];
    const entries = Array.isArray(raw) ? raw : [raw];
    const out: ChartApp[] = [];
    for (const [i, e] of entries.entries()) {
      const name = e["im:name"]?.label?.trim();
      const appId = e.id?.attributes?.["im:id"];
      if (!name || !appId) continue;
      const link = Array.isArray(e.link) ? e.link[0] : e.link;
      out.push({
        appId,
        name,
        url: link?.attributes?.href ?? e.id?.label,
        artist: e["im:artist"]?.label,
        rank: i + 1,
        country,
      });
    }
    return out;
  } catch {
    return [];
  }
}
