import type { Review, ReviewSignal, ReviewSignalKind } from "@hahaton/contracts";
import { type LlmProvider, MODELS } from "@hahaton/llm";

/**
 * Classify mined reviews into signals. Batched LLM calls (structured JSON array),
 * multilingual-aware. Resilient: a malformed/failed batch is skipped, never
 * sinking the whole run. competitorId + rating are stamped from the source review
 * (the model only returns reviewId + kind + theme + optional quote).
 */
const KINDS: ReviewSignalKind[] = [
  "pain",
  "praised_feature",
  "missing_feature",
  "pricing_issue",
  "ux_issue",
  "reliability_bug",
  "onboarding_confusion",
  "switching_reason",
  "audience_hint",
];
const KIND_SET = new Set<string>(KINDS);

const SYSTEM_PROMPT = `You classify mobile-app store reviews into signals for a founder. Reviews may be multilingual (Ukrainian / Russian / English) — read any language.
For each review, emit ZERO OR MORE signals using ONLY these kinds:
${KINDS.join(", ")}.
Respond with ONLY a JSON array (no markdown):
[{ "reviewId": "<id exactly as given>", "kind": "<one kind>", "theme": "<short English normalized phrase>", "quote": "<optional short verbatim quote>" }]
A review with nothing useful yields no entries.`;

interface RawSignal {
  reviewId?: string;
  kind?: string;
  theme?: string;
  quote?: string;
}

function extractArray(raw: string): RawSignal[] {
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function classifyReviews(
  llm: LlmProvider,
  reviews: Review[],
  opts: { batchSize?: number } = {},
): Promise<ReviewSignal[]> {
  const batchSize = opts.batchSize ?? 20;
  const byId = new Map(reviews.map((r) => [r.id, r]));
  const out: ReviewSignal[] = [];

  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize);
    const payload = batch.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
    }));
    try {
      const response = await llm.chat({
        model: MODELS.sonnet,
        maxTokens: 1500,
        temperature: 0.2,
        messages: [
          { role: "system", content: [{ type: "text", text: SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "text", text: JSON.stringify(payload) }] },
        ],
      });
      for (const s of extractArray(response.content ?? "")) {
        if (!s.reviewId || !s.kind || !s.theme) continue;
        if (!KIND_SET.has(s.kind)) continue;
        const src = byId.get(s.reviewId);
        if (!src) continue;
        out.push({
          reviewId: s.reviewId,
          competitorId: src.competitorId,
          kind: s.kind as ReviewSignalKind,
          theme: s.theme,
          quote: s.quote,
          rating: src.rating,
        });
      }
    } catch {
      // Skip a failed batch; never sink the whole classification.
    }
  }
  return out;
}
