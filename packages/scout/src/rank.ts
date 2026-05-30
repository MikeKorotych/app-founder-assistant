import { LlmChatMessageRole, type LlmProvider, MODELS } from "@hahaton/llm";
import type { RawCompetitor, ScoredCompetitor, ScoutParams } from "./types.js";

/**
 * Rank candidates by how directly each competes with the idea. One batched
 * Haiku call returns `[{ id, score, rationale }]`; we attach scores and sort
 * descending. Deterministic (temperature 0); robust to malformed output
 * (unscored candidates default to 0 so they sink to the bottom, never dropped).
 */

const SYSTEM = `You are a competitive-analysis assistant for mobile-app founders.
Given a target app idea and a list of candidate apps, score how DIRECTLY each
candidate competes with the idea from 0 to 100:
- 90-100: head-on competitor (same core job, same audience)
- 60-89: strong overlap (adjacent job or partial audience)
- 30-59: tangential (shares a theme but different job/audience)
- 0-29: barely related
Return ONLY a JSON object: {"scores":[{"id":"<id>","score":<0-100>,"rationale":"<one short sentence>"}]}.
Score every candidate id exactly once. No prose outside the JSON.`;

function ideaText(params: ScoutParams): string {
  if (params.idea && params.idea.trim().length > 0) return params.idea.trim();
  const parts = [params.keywords.join(", ")];
  if (params.categories?.length) parts.push(`categories: ${params.categories.join(", ")}`);
  return parts.join(" — ");
}

function candidateLine(c: RawCompetitor): string {
  const bits = [`id=${c.id}`, `name=${c.name}`, `source=${c.source}`];
  if (c.category) bits.push(`category=${c.category}`);
  if (c.description) bits.push(`desc=${c.description.slice(0, 240)}`);
  return bits.join(" | ");
}

interface ScoreEntry {
  id: string;
  score: number;
  rationale: string;
}

/** Pull the JSON object out of the model's reply, tolerating stray text/fences. */
function parseScores(content: string | null): Map<string, ScoreEntry> {
  const map = new Map<string, ScoreEntry>();
  if (!content) return map;
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1) return map;
  try {
    const parsed = JSON.parse(content.slice(start, end + 1)) as { scores?: ScoreEntry[] };
    for (const s of parsed.scores ?? []) {
      if (typeof s?.id !== "string") continue;
      const score = Math.max(0, Math.min(100, Number(s.score) || 0));
      map.set(s.id, { id: s.id, score, rationale: String(s.rationale ?? "") });
    }
  } catch {
    // Leave the map empty → all candidates fall back to unscored.
  }
  return map;
}

export async function rankCompetitors(
  llm: LlmProvider,
  params: ScoutParams,
  candidates: RawCompetitor[],
): Promise<ScoredCompetitor[]> {
  if (candidates.length === 0) return [];

  const userPrompt = [
    `IDEA: ${ideaText(params)}`,
    "",
    "CANDIDATES:",
    ...candidates.map(candidateLine),
  ].join("\n");

  const res = await llm.chat({
    model: MODELS.haiku,
    temperature: 0,
    maxTokens: 4096,
    messages: [
      { role: LlmChatMessageRole.System, content: SYSTEM },
      { role: LlmChatMessageRole.User, content: userPrompt },
    ],
  });

  const scores = parseScores(res.content);
  return candidates
    .map<ScoredCompetitor>((c) => {
      const s = scores.get(c.id);
      return {
        ...c,
        compatibilityScore: s?.score ?? 0,
        rationale: s?.rationale || "Not scored by the model.",
      };
    })
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
}
