/**
 * Global Digest (M6) — synthesis layer for the recurring worldwide snapshot.
 *
 * Detection is deterministic: group "top new" App Store charts by app and rank
 * by cross-market breadth (an app rising in many countries' new-apps feed has
 * momentum). One optional batched LLM call adds a one-liner per app + a short
 * summary (Ukrainian via withOutputLanguage). Pure of scout/clock — the caller
 * passes the fetched charts plus id + createdAt.
 */

import type { AppStoreDetails, ChartApp, DigestApp, GlobalDigest } from "@hahaton/contracts";
import { type LlmProvider, MODELS } from "@hahaton/llm";
import { withOutputLanguage } from "../llm-language";

export interface GlobalDigestInput {
  id: string;
  createdAt: string;
  charts: ChartApp[];
  countriesScanned: string[];
  /** Max risers to include. Default 12. */
  limit?: number;
  /** Injected real-metadata fetcher (scout.fetchItunesAppDetails) — keeps agent decoupled. */
  fetchDetails?: (appIds: string[]) => Promise<Map<string, AppStoreDetails>>;
}

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Merge real store metadata onto a riser + derive metrics and a momentum score.
// reviews/age are real; installs are estimated (Apple doesn't expose downloads).
function enrichApp(a: DigestApp, d: AppStoreDetails | undefined, nowIso: string): DigestApp {
  if (!d) return a;
  const m: DigestApp = {
    ...a,
    iconUrl: d.iconUrl,
    description: d.description,
    screenshots: d.screenshots,
    releaseDate: d.releaseDate,
    rating: d.rating,
    reviewCount: d.reviewCount,
    genre: d.genre,
    price: d.price,
  };
  const rel = d.releaseDate ? Date.parse(d.releaseDate) : Number.NaN;
  const now = Date.parse(nowIso);
  if (!Number.isNaN(rel) && !Number.isNaN(now) && now > rel) {
    const ageMonths = Math.max(0.5, (now - rel) / MS_PER_MONTH);
    m.ageMonths = Math.round(ageMonths * 10) / 10;
    if (typeof d.reviewCount === "number") {
      m.reviewsPerMonth = Math.round(d.reviewCount / ageMonths);
      m.estInstalls = d.reviewCount * 50;
      m.estInstallsPerMonth = Math.round(m.estInstalls / ageMonths);
    }
    const velocityScore = clamp(Math.log10((m.reviewsPerMonth ?? 0) + 1) * 33, 0, 100);
    const ratingScore = ((d.rating ?? 0) / 5) * 100;
    const breadthScore = clamp(a.marketCount * 8, 0, 100);
    const freshnessScore = clamp(100 - m.ageMonths * 5, 0, 100);
    m.score = Math.round(
      0.4 * velocityScore + 0.3 * ratingScore + 0.2 * breadthScore + 0.1 * freshnessScore,
    );
  }
  return m;
}

function detectRisers(charts: ChartApp[], limit: number): DigestApp[] {
  const byApp = new Map<string, DigestApp>();
  for (const c of charts) {
    let a = byApp.get(c.appId);
    if (!a) {
      a = {
        appId: c.appId,
        name: c.name,
        url: c.url,
        markets: [],
        marketCount: 0,
        bestRank: c.rank,
      };
      byApp.set(c.appId, a);
    }
    a.markets.push({ country: c.country, rank: c.rank });
  }
  const all = [...byApp.values()].map((a) => {
    const markets = a.markets.sort((x, y) => x.rank - y.rank);
    return { ...a, markets, marketCount: markets.length, bestRank: markets[0].rank };
  });
  // Cross-market momentum first; require ≥2 markets when we have enough, else relax.
  const multi = all.filter((a) => a.marketCount >= 2);
  const pool = multi.length >= 5 ? multi : all;
  return pool
    .sort((a, b) => b.marketCount - a.marketCount || a.bestRank - b.bestRank)
    .slice(0, limit);
}

const ENRICH_SYSTEM = `You write a concise global digest of NEW mobile apps that are rising across multiple countries' App Store "new apps" charts. From each app's name, optional store description, and the markets/ranks it's charting in, write a one-line note (what it is / why it's likely rising). Also write a 1-2 sentence overall summary of what's moving worldwide. Be cautious — you only have names + chart positions.
Respond with ONLY valid JSON (no markdown):
{ "summary": "<1-2 sentences>", "apps": [{ "appId": "<id exactly as given>", "note": "<one line>" }] }`;

interface RawEnrich {
  summary?: string;
  apps?: Array<{ appId?: string; note?: string }>;
}

function extractObject(raw: string): RawEnrich {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try {
    return JSON.parse(m[0]) as RawEnrich;
  } catch {
    return {};
  }
}

export async function buildGlobalDigest(
  llm: LlmProvider,
  input: GlobalDigestInput,
): Promise<GlobalDigest> {
  let globalRisers = detectRisers(input.charts, input.limit ?? 12);
  // Enrich with real App Store metadata (icon, screenshots, reviews, age) +
  // derived metrics + a momentum score.
  if (input.fetchDetails && globalRisers.length > 0) {
    try {
      const details = await input.fetchDetails(globalRisers.map((a) => a.appId));
      globalRisers = globalRisers.map((a) => enrichApp(a, details.get(a.appId), input.createdAt));
    } catch {
      // keep un-enriched risers on failure
    }
  }
  const base: GlobalDigest = {
    id: input.id,
    createdAt: input.createdAt,
    countriesScanned: input.countriesScanned,
    globalRisers,
  };
  if (globalRisers.length === 0) return base;

  try {
    const lm = withOutputLanguage(llm);
    const payload = globalRisers.map((a) => ({
      appId: a.appId,
      name: a.name,
      markets: a.markets.slice(0, 6).map((m) => `${m.country}#${m.rank}`),
      desc: a.description ? a.description.slice(0, 280) : undefined,
    }));
    const res = await lm.chat({
      model: MODELS.sonnet,
      maxTokens: 1600,
      temperature: 0.4,
      messages: [
        { role: "system", content: [{ type: "text", text: ENRICH_SYSTEM }] },
        { role: "user", content: [{ type: "text", text: JSON.stringify(payload) }] },
      ],
    });
    const parsed = extractObject(res.content ?? "");
    const notes = new Map((parsed.apps ?? []).map((x) => [x.appId, x.note]));
    return {
      ...base,
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : undefined,
      globalRisers: globalRisers.map((a) => {
        const note = notes.get(a.appId);
        return note ? { ...a, note: note.trim() } : a;
      }),
    };
  } catch {
    return base;
  }
}
