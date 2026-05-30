import { dedupeById } from "../normalize.js";
import type { RawCompetitor, ScoutParams } from "../types.js";

/**
 * AlternativeTo has no public API, so we scrape its search page with the
 * Workers-native `HTMLRewriter` (streaming, no DOM, no extra deps). This is
 * best-effort and brittle by nature — if the markup shifts it simply yields
 * fewer/zero results and the run continues on the other sources.
 *
 * Search page: https://alternativeto.net/browse/search/?q=<term>
 * App cards link to /software/<slug>/ and carry the app name in the anchor.
 */
const BASE = "https://alternativeto.net";

/** Collects `/software/<slug>/` links + their text via HTMLRewriter. */
class AppLinkCollector {
  readonly found: { slug: string; name: string }[] = [];
  private current: { slug: string; name: string } | null = null;

  element(el: Element): void {
    const href = el.getAttribute("href") ?? "";
    const match = href.match(/^\/software\/([a-z0-9-]+)\/?$/i);
    if (match) {
      this.current = { slug: match[1], name: "" };
      this.found.push(this.current);
    } else {
      this.current = null;
    }
  }

  text(chunk: { text: string }): void {
    if (this.current) this.current.name += chunk.text;
  }
}

async function searchOne(term: string): Promise<RawCompetitor[]> {
  const res = await fetch(`${BASE}/browse/search/?q=${encodeURIComponent(term)}`, {
    headers: { "User-Agent": "hahaton-2026-scout/0.1 (+research)", Accept: "text/html" },
  });
  if (!res.ok) throw new Error(`AlternativeTo ${res.status} for "${term}"`);

  const collector = new AppLinkCollector();
  await new HTMLRewriter().on('a[href^="/software/"]', collector).transform(res).arrayBuffer();

  const seen = new Set<string>();
  return collector.found
    .filter((a) => {
      const name = a.name.trim();
      if (!name || seen.has(a.slug)) return false;
      seen.add(a.slug);
      return true;
    })
    .map<RawCompetitor>((a) => ({
      id: `alt-${a.slug}`,
      name: a.name.trim(),
      source: "alternativeto",
      url: `${BASE}/software/${a.slug}/`,
      platforms: ["web"],
      rating: 0,
      reviewCount: 0,
    }));
}

export async function fetchAlternativeTo(params: ScoutParams): Promise<RawCompetitor[]> {
  const perKeyword = await Promise.all(params.keywords.map(searchOne));
  return dedupeById(perKeyword.flat());
}
