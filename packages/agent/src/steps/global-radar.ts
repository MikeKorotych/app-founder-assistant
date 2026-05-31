/**
 * Global Niche Radar — synthesis layer.
 *
 * Detection is deterministic (plain TS): group the App Store charts by app,
 * compute which markets each charts in, and flag the ones ABSENT in the
 * founder's home market — geo-arbitrage signals. A single batched LLM call then
 * enriches the top localized winners with "what it does" + "takeaway" (Ukrainian
 * via withOutputLanguage). Growth-over-time is deferred (needs paid APIs).
 */

import type { ChartApp, GlobalNicheRadar, GlobalRadarEntry } from "@hahaton/contracts";
import { type LlmProvider, MODELS } from "@hahaton/llm";
import { withOutputLanguage } from "../llm-language";

export interface GlobalRadarInput {
  idea: string;
  /** The founder's home market — apps charting here are NOT "undiscovered". */
  homeCountry: string;
  /** Flat charts from collectCharts (ChartApp[] tagged with country + rank). */
  charts: ChartApp[];
  genreLabel?: string;
  countriesScanned: string[];
  /** Max localized winners to enrich. Default 8. */
  limit?: number;
}

// Deterministic detection: group by app, find localized winners.
function detect(charts: ChartApp[], homeCountry: string): GlobalRadarEntry[] {
  const home = homeCountry.toLowerCase();
  const byApp = new Map<
    string,
    { name: string; url?: string; markets: { country: string; rank: number }[] }
  >();
  for (const c of charts) {
    let g = byApp.get(c.appId);
    if (!g) {
      g = { name: c.name, url: c.url, markets: [] };
      byApp.set(c.appId, g);
    }
    g.markets.push({ country: c.country, rank: c.rank });
  }
  const entries: GlobalRadarEntry[] = [];
  for (const [appId, g] of byApp) {
    const markets = g.markets.sort((a, b) => a.rank - b.rank);
    entries.push({
      appId,
      name: g.name,
      url: g.url,
      markets,
      bestRank: markets[0].rank,
      marketCount: markets.length,
      absentAtHome: !markets.some((m) => m.country.toLowerCase() === home),
    });
  }
  // Localized winners: absent in the home chart, strongest foreign rank first,
  // then the more "hidden" (fewer markets) ranked higher.
  return entries
    .filter((e) => e.absentAtHome)
    .sort((a, b) => a.bestRank - b.bestRank || a.marketCount - b.marketCount);
}

const ENRICH_SYSTEM = `You help a founder spot geo-arbitrage — apps that chart in some countries but are absent in the founder's home market. For EACH given app, infer from its name + the markets/ranks it charts in: what it likely does, and the takeaway for the founder (what is worth porting or learning). Be concise and cautious — you only have the name and chart positions, so don't over-claim.
Respond with ONLY a JSON array (no markdown):
[{ "appId": "<id exactly as given>", "whatItDoes": "<one line>", "takeaway": "<one line>" }]`;

interface RawEnrich {
  appId?: string;
  whatItDoes?: string;
  takeaway?: string;
}

function extractArray(raw: string): RawEnrich[] {
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
const asStr = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

async function enrich(
  llm: LlmProvider,
  idea: string,
  entries: GlobalRadarEntry[],
): Promise<GlobalRadarEntry[]> {
  const payload = entries.map((e) => ({
    appId: e.appId,
    name: e.name,
    markets: e.markets.slice(0, 5).map((m) => `${m.country}#${m.rank}`),
  }));
  try {
    const res = await llm.chat({
      model: MODELS.sonnet,
      maxTokens: 1500,
      temperature: 0.4,
      messages: [
        { role: "system", content: [{ type: "text", text: ENRICH_SYSTEM }] },
        {
          role: "user",
          content: [
            { type: "text", text: `Founder idea: ${idea}\n\nApps:\n${JSON.stringify(payload)}` },
          ],
        },
      ],
    });
    const map = new Map(extractArray(res.content ?? "").map((x) => [x.appId, x]));
    return entries.map((e) => {
      const m = map.get(e.appId);
      return m ? { ...e, whatItDoes: asStr(m.whatItDoes), takeaway: asStr(m.takeaway) } : e;
    });
  } catch {
    return entries;
  }
}

/**
 * Build the Global Niche Radar: detect localized winners (deterministic), then
 * enrich the top ones with a single batched LLM call.
 */
export async function buildGlobalRadar(
  llm: LlmProvider,
  input: GlobalRadarInput,
): Promise<GlobalNicheRadar> {
  const detected = detect(input.charts, input.homeCountry);
  const top = detected.slice(0, input.limit ?? 8);
  const entries = top.length > 0 ? await enrich(withOutputLanguage(llm), input.idea, top) : top;
  return {
    homeCountry: input.homeCountry,
    genreLabel: input.genreLabel,
    countriesScanned: input.countriesScanned,
    entries,
  };
}

// App Store category genre ids — the closed set the resolver picks from.
const APP_STORE_GENRES: { id: number; label: string }[] = [
  { id: 6000, label: "Business" },
  { id: 6017, label: "Education" },
  { id: 6016, label: "Entertainment" },
  { id: 6015, label: "Finance" },
  { id: 6023, label: "Food & Drink" },
  { id: 6014, label: "Games" },
  { id: 6013, label: "Health & Fitness" },
  { id: 6012, label: "Lifestyle" },
  { id: 6020, label: "Medical" },
  { id: 6011, label: "Music" },
  { id: 6010, label: "Navigation" },
  { id: 6009, label: "News" },
  { id: 6008, label: "Photo & Video" },
  { id: 6007, label: "Productivity" },
  { id: 6006, label: "Reference" },
  { id: 6024, label: "Shopping" },
  { id: 6005, label: "Social Networking" },
  { id: 6004, label: "Sports" },
  { id: 6002, label: "Travel" },
  { id: 6003, label: "Utilities" },
  { id: 6001, label: "Weather" },
];

/**
 * Pick the single most relevant App Store category for an idea (one cheap LLM
 * call). Returns null on any failure → caller falls back to overall charts.
 */
export async function resolveAppStoreGenre(
  llm: LlmProvider,
  idea: string,
): Promise<{ id: number; label: string } | null> {
  const list = APP_STORE_GENRES.map((g) => `${g.id} ${g.label}`).join(", ");
  try {
    const res = await llm.chat({
      model: MODELS.sonnet,
      maxTokens: 60,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: `Pick the single best-fitting App Store category id for the app idea from this list: ${list}. Respond with ONLY the numeric id.`,
            },
          ],
        },
        { role: "user", content: [{ type: "text", text: idea }] },
      ],
    });
    const id = Number((res.content ?? "").match(/\d{4}/)?.[0]);
    return APP_STORE_GENRES.find((g) => g.id === id) ?? null;
  } catch {
    return null;
  }
}
