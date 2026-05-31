/**
 * Opportunity Radar — synthesis layer.
 *
 * Pipeline: Scout competitors → fetch their reviews → classify into
 * `ReviewSignal`s (both in @hahaton/scout) → **cluster recurring themes** →
 * **synthesize an `OpportunityReport`** (here).
 *
 * The report is a DECISION MAP ("what to test first"), never a verdict
 * ("good/bad idea"). Clustering is deterministic (plain TS, no LLM); only the
 * narrative judgement calls (saturation, gap, ICP, 7-day test, kill criterion)
 * go through the model — and through `withOutputLanguage`, so prose is Ukrainian.
 */

import type {
  OpportunityReport,
  ReviewCluster,
  ReviewSignal,
  ReviewSignalKind,
} from "@hahaton/contracts";
import { type LlmProvider, MODELS } from "@hahaton/llm";
import { withOutputLanguage } from "../llm-language";

/** Signal kinds that represent friction/complaints → fold into "top pains". */
const PAIN_KINDS: ReviewSignalKind[] = [
  "pain",
  "pricing_issue",
  "ux_issue",
  "reliability_bug",
  "onboarding_confusion",
  "switching_reason",
];

// ---------------------------------------------------------------------------
// Deterministic clustering — group signals by (kind, normalized theme).
// ---------------------------------------------------------------------------

const normKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Roll classified signals into recurring themes. Pure/deterministic: groups by
 * kind + normalized theme, counts strength, collects up to 3 distinct quotes.
 * Returned sorted by count desc.
 */
export function clusterSignals(signals: ReviewSignal[]): ReviewCluster[] {
  const groups = new Map<string, ReviewCluster>();
  for (const s of signals) {
    const key = `${s.kind}::${normKey(s.theme)}`;
    let c = groups.get(key);
    if (!c) {
      c = { kind: s.kind, label: s.theme.trim(), count: 0, examples: [] };
      groups.set(key, c);
    }
    c.count += 1;
    const q = s.quote?.trim();
    if (q && c.examples.length < 3 && !c.examples.includes(q)) c.examples.push(q);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Synthesis — the judgement calls (LLM), grounded in the clusters.
// ---------------------------------------------------------------------------

export interface OpportunityInput {
  /** The idea being evaluated. */
  idea: string;
  /** Classified signals from competitor reviews (from @hahaton/scout). */
  signals: ReviewSignal[];
  /** Total reviews mined (sample size, surfaced for honesty). */
  reviewsAnalyzed: number;
  /** Per-source review counts for transparency. */
  sources: Array<{ source: string; reviews: number }>;
  /** Names of the competitors whose reviews were mined. */
  competitorNames?: string[];
}

const SYSTEM_PROMPT = `You are a startup market analyst. A founder gives you an idea plus signals mined and clustered from real competitor app-store reviews. Produce a DECISION MAP — "what to test first" — NOT a verdict ("good/bad idea"). Be concrete, specific and honest; if the sample is small, say so and stay tentative.

You receive:
- the idea,
- clustered PAINS (recurring complaints, with strength counts + quotes),
- clustered PRAISED features,
- the competitors mined and the review sample size.

Respond with ONLY valid JSON in this exact shape (no markdown):
{
  "oneTwoStarReasons": ["<3-5 distilled reasons users give 1-2 stars>"],
  "saturation": "<1-2 sentences: where the market looks crowded / red zone>",
  "opportunityGap": "<1-2 sentences: the clearest unfilled niche the reviews reveal>",
  "firstIcp": "<the narrow first audience to target, and why>",
  "differentiation": "<how THIS idea could win where incumbents are weak, tied to the pains>",
  "sevenDayTest": "<one concrete experiment runnable in 7 days to validate the biggest unknown>",
  "killCriterion": "<a falsifiable result at which the founder should drop the idea>"
}`;

function buildContext(input: OpportunityInput, clusters: ReviewCluster[]): string {
  const pains = clusters.filter((c) => PAIN_KINDS.includes(c.kind)).slice(0, 8);
  const loved = clusters.filter((c) => c.kind === "praised_feature").slice(0, 6);
  const lines: string[] = [];
  lines.push(`IDEA: ${input.idea}`);
  lines.push(
    `\nSAMPLE: ${input.reviewsAnalyzed} reviews across ${input.sources.map((s) => `${s.source} (${s.reviews})`).join(", ") || "—"}`,
  );
  if (input.competitorNames?.length) {
    lines.push(`COMPETITORS MINED: ${input.competitorNames.slice(0, 8).join(", ")}`);
  }
  lines.push("\nRECURRING PAINS (strength × quote):");
  for (const c of pains) {
    lines.push(
      `  • [${c.kind} ×${c.count}] ${c.label}${c.examples[0] ? ` — "${c.examples[0]}"` : ""}`,
    );
  }
  if (!pains.length) lines.push("  (none extracted)");
  lines.push("\nPRAISED FEATURES (strength × quote):");
  for (const c of loved) {
    lines.push(`  • [×${c.count}] ${c.label}${c.examples[0] ? ` — "${c.examples[0]}"` : ""}`);
  }
  if (!loved.length) lines.push("  (none extracted)");
  return lines.join("\n");
}

function extractJson(raw: string): Record<string, unknown> {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`[opportunity] No JSON in response: ${raw.slice(0, 200)}`);
  try {
    return JSON.parse(m[0]);
  } catch (err) {
    throw new Error(
      `[opportunity] Malformed JSON (likely truncated): ${(err as Error).message} — raw: ${raw.slice(0, 300)}`,
    );
  }
}

const asStr = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const asStrArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()) : [];

/**
 * Build the Opportunity Radar from classified review signals. Clusters
 * deterministically, then asks the model for the grounded judgement calls.
 * Decoupled from @hahaton/scout — it only needs signals + sample metadata.
 */
export async function buildOpportunityReport(
  llm: LlmProvider,
  input: OpportunityInput,
): Promise<OpportunityReport> {
  const clusters = clusterSignals(input.signals);
  const topPains = clusters.filter((c) => PAIN_KINDS.includes(c.kind)).slice(0, 6);
  const loved = clusters.filter((c) => c.kind === "praised_feature").slice(0, 6);

  // No signals → return an honest, empty-but-shaped report without an LLM call.
  if (input.signals.length === 0) {
    return {
      topPains,
      loved,
      oneTwoStarReasons: [],
      saturation: "Недостатньо відгуків для оцінки насиченості ринку.",
      opportunityGap: "Замало даних — потрібно більше відгуків конкурентів.",
      firstIcp: "—",
      differentiation: "—",
      sevenDayTest:
        "Зібрати 20–30 відгуків на 3 топ-конкурентів вручну й перечитати найнижчі оцінки.",
      killCriterion: "—",
      reviewsAnalyzed: input.reviewsAnalyzed,
      sources: input.sources,
    };
  }

  const lm = withOutputLanguage(llm);
  const context = buildContext(input, clusters);

  const response = await lm.chat({
    model: MODELS.sonnet,
    maxTokens: 1800,
    temperature: 0.4,
    messages: [
      { role: "system", content: [{ type: "text", text: SYSTEM_PROMPT }] },
      {
        role: "user",
        content: [
          { type: "text", text: context, cacheControl: { ttl: "5m" } },
          { type: "text", text: "\nProduce the decision map now." },
        ],
      },
    ],
  });

  const parsed = extractJson(response.content ?? "");

  return {
    topPains,
    loved,
    oneTwoStarReasons: asStrArr(parsed.oneTwoStarReasons),
    saturation: asStr(parsed.saturation),
    opportunityGap: asStr(parsed.opportunityGap),
    firstIcp: asStr(parsed.firstIcp),
    differentiation: asStr(parsed.differentiation),
    sevenDayTest: asStr(parsed.sevenDayTest),
    killCriterion: asStr(parsed.killCriterion),
    reviewsAnalyzed: input.reviewsAnalyzed,
    sources: input.sources,
  };
}
