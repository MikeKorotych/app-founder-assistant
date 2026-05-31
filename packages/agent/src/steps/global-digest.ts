/**
 * Global Digest (M6) — synthesis layer for the recurring worldwide snapshot.
 *
 * Detection is deterministic: group "top new" App Store charts by app and rank
 * by cross-market breadth (an app rising in many countries' new-apps feed has
 * momentum). One optional batched LLM call adds a one-liner per app + a short
 * summary (Ukrainian via withOutputLanguage). Pure of scout/clock — the caller
 * passes the fetched charts plus id + createdAt.
 */

import type { ChartApp, DigestApp, GlobalDigest } from "@hahaton/contracts";
import { type LlmProvider, MODELS } from "@hahaton/llm";
import { withOutputLanguage } from "../llm-language";

export interface GlobalDigestInput {
  id: string;
  createdAt: string;
  charts: ChartApp[];
  countriesScanned: string[];
  /** Max risers to include. Default 12. */
  limit?: number;
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

const ENRICH_SYSTEM = `You write a concise global digest of NEW mobile apps that are rising across multiple countries' App Store "new apps" charts. From each app's name + the markets/ranks it's charting in, infer a one-line note (what it is / why it's likely rising). Also write a 1-2 sentence overall summary of what's moving worldwide. Be cautious — you only have names + chart positions.
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
  const globalRisers = detectRisers(input.charts, input.limit ?? 12);
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
