/**
 * Competitive Landscape — per-competitor synthesis.
 *
 * For each top competitor, group its own classified review signals and ask the
 * model for an at-a-glance profile: the general positive theme, the general
 * negative theme, strengths, weaknesses, its distinctive "hook", and what a
 * founder should be inspired by vs. avoid. Quantitative fields (reviews, rating,
 * launch date, estimated installs) are passed through unchanged.
 *
 * Reasoning layer only — consumes ReviewSignal[] (from @hahaton/scout); the
 * narrative comes back Ukrainian via `withOutputLanguage`.
 */

import type { CompetitorProfile, ReviewSignal, ReviewSignalKind } from "@hahaton/contracts";
import { type LlmProvider, MODELS } from "@hahaton/llm";
import { withOutputLanguage } from "../llm-language";

/** Quantitative + identity fields the caller already knows per competitor. */
export interface LandscapeCompetitor {
  id: string;
  name: string;
  source: string;
  url?: string;
  /** Store positioning / rationale, if any — used when reviews are sparse. */
  positioning?: string;
  reviewCount: number;
  rating?: number;
  launchedAt?: string;
  estimatedInstalls?: number;
  /** Official Google Play install bucket ("500M+"), Android only. */
  installsText?: string;
}

export interface LandscapeInput {
  idea: string;
  competitors: LandscapeCompetitor[];
  signals: ReviewSignal[];
  /** Max competitors to profile (cost bound). Default 6. */
  limit?: number;
}

const POSITIVE_KINDS: ReviewSignalKind[] = ["praised_feature"];

const SYSTEM_PROMPT = `You profile ONE competitor app for a founder scanning a niche. You are given the founder's idea, the competitor's positioning, and signals mined from THIS competitor's own reviews. Produce a crisp, at-a-glance profile.

Respond with ONLY valid JSON in this exact shape (no markdown):
{
  "positiveTheme": "<one phrase: what users generally LOVE about it>",
  "negativeTheme": "<one phrase: what users generally COMPLAIN about>",
  "strengths": ["<2-3 concrete strengths>"],
  "weaknesses": ["<2-3 concrete weaknesses>"],
  "hook": "<its distinctive angle / what makes it stand out in one line>",
  "inspiration": "<what the founder could be inspired by here>",
  "avoid": "<what the founder should avoid / not repeat from this competitor>"
}
Base it strictly on the provided signals + positioning. If reviews are sparse, infer cautiously from positioning and say less rather than invent.`;

function competitorContext(c: LandscapeCompetitor, idea: string, signals: ReviewSignal[]): string {
  const mine = signals.filter((s) => s.competitorId === c.id);
  const pos = mine.filter((s) => POSITIVE_KINDS.includes(s.kind));
  const neg = mine.filter((s) => !POSITIVE_KINDS.includes(s.kind));
  const fmt = (s: ReviewSignal) => `  • [${s.kind}] ${s.theme}${s.quote ? ` — "${s.quote}"` : ""}`;
  const lines = [
    `FOUNDER IDEA: ${idea}`,
    `\nCOMPETITOR: ${c.name} (${c.source})`,
    c.positioning ? `POSITIONING: ${c.positioning}` : "",
    `REVIEWS: ${c.reviewCount}${c.rating ? `, ★ ${c.rating}` : ""}${c.installsText ? `, ${c.installsText} installs (Google Play)` : ""}`,
    `\nPOSITIVE SIGNALS (${pos.length}):`,
    ...(pos.length ? pos.slice(0, 8).map(fmt) : ["  (none)"]),
    `\nNEGATIVE SIGNALS (${neg.length}):`,
    ...(neg.length ? neg.slice(0, 8).map(fmt) : ["  (none)"]),
  ];
  return lines.filter(Boolean).join("\n");
}

function extractJson(raw: string): Record<string, unknown> {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`[landscape] No JSON in response: ${raw.slice(0, 200)}`);
  return JSON.parse(m[0]);
}
const asStr = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const asStrArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()) : [];

async function profileOne(
  llm: LlmProvider,
  idea: string,
  c: LandscapeCompetitor,
  signals: ReviewSignal[],
): Promise<CompetitorProfile> {
  const reviewsAnalyzed = signals.filter((s) => s.competitorId === c.id).length;
  const base: CompetitorProfile = {
    competitorId: c.id,
    name: c.name,
    source: c.source,
    url: c.url,
    reviewCount: c.reviewCount,
    rating: c.rating,
    estimatedInstalls: c.estimatedInstalls,
    installsText: c.installsText,
    launchedAt: c.launchedAt,
    reviewsAnalyzed,
    positiveTheme: "",
    negativeTheme: "",
    strengths: [],
    weaknesses: [],
    hook: "",
    inspiration: "",
    avoid: "",
  };

  try {
    const response = await llm.chat({
      model: MODELS.sonnet,
      maxTokens: 900,
      temperature: 0.4,
      messages: [
        { role: "system", content: [{ type: "text", text: SYSTEM_PROMPT }] },
        {
          role: "user",
          content: [{ type: "text", text: competitorContext(c, idea, signals) }],
        },
      ],
    });
    const p = extractJson(response.content ?? "");
    return {
      ...base,
      positiveTheme: asStr(p.positiveTheme),
      negativeTheme: asStr(p.negativeTheme),
      strengths: asStrArr(p.strengths),
      weaknesses: asStrArr(p.weaknesses),
      hook: asStr(p.hook),
      inspiration: asStr(p.inspiration),
      avoid: asStr(p.avoid),
    };
  } catch {
    // A single competitor's synthesis failing must not sink the whole landscape.
    return base;
  }
}

/**
 * Build per-competitor profiles for the Competitive Landscape block. Profiles
 * the top `limit` competitors (by review count) in parallel. Decoupled from
 * scout — needs only the competitor identities + the classified signals.
 */
export async function buildCompetitorProfiles(
  llm: LlmProvider,
  input: LandscapeInput,
): Promise<CompetitorProfile[]> {
  const lm = withOutputLanguage(llm);
  const top = [...input.competitors]
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, input.limit ?? 6);
  return Promise.all(top.map((c) => profileOne(lm, input.idea, c, input.signals)));
}
