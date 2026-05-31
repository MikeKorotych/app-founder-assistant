/**
 * @hahaton/scout — mobile-app competitor discovery + LLM compatibility ranking.
 *
 * Runtime-agnostic core. The durable orchestration (isolated, retried steps)
 * lives in the Cloudflare Workflow in `@hahaton/api`; these functions are what
 * each step calls. `runScout` runs the whole thing in-process for tests/local.
 */
import type { Db } from "@hahaton/db";
import type { LlmProvider } from "@hahaton/llm";
import { dedupeById } from "./normalize.js";
import { persistCompetitors } from "./persist.js";
import { rankCompetitors } from "./rank.js";
import { fetchAlternativeTo } from "./sources/alternativeto.js";
import { fetchGooglePlay } from "./sources/googleplay.js";
import { fetchItunes } from "./sources/itunes.js";
import { fetchProductHunt } from "./sources/producthunt.js";
import type { RawCompetitor, ScoutParams, ScoutSummary } from "./types.js";

// Opportunity Radar data-layer — review mining + signal classification.
export { classifyReviews } from "./classify.js";
export { dedupeById } from "./normalize.js";
export { listCompetitors, persistCompetitors } from "./persist.js";
export { rankCompetitors } from "./rank.js";
export type { CollectReviewsOpts } from "./reviews.js";
export { collectReviews } from "./reviews.js";
export { fetchAlternativeTo } from "./sources/alternativeto.js";
export { fetchGooglePlay } from "./sources/googleplay.js";
export { fetchGooglePlayReviews } from "./sources/googleplay-reviews.js";
export { fetchItunes } from "./sources/itunes.js";
export { fetchItunesReviews } from "./sources/itunes-reviews.js";
export { fetchProductHunt } from "./sources/producthunt.js";
export type {
  RawCompetitor,
  ScoredCompetitor,
  ScoutParams,
  ScoutSummary,
  SourceId,
} from "./types.js";

/** Credentials/handles the in-process runner needs. */
export interface ScoutDeps {
  llm: LlmProvider;
  db: Db;
  searchApiKey?: string;
  productHuntToken?: string;
}

/**
 * Run the full pipeline in one process (no Workflow). Fetches all sources
 * concurrently — a failing source degrades to empty rather than sinking the run
 * — then ranks and persists. The Workflow variant isolates+retries each step.
 */
export async function runScout(
  deps: ScoutDeps,
  runId: string,
  params: ScoutParams,
): Promise<ScoutSummary> {
  const country = params.country ?? "us";
  const sources: [string, Promise<RawCompetitor[]>][] = [
    ["itunes", fetchItunes(params, country)],
    ["googleplay", fetchGooglePlay(params, deps.searchApiKey, country)],
    ["producthunt", fetchProductHunt(params, deps.productHuntToken)],
    ["alternativeto", fetchAlternativeTo(params)],
  ];
  const settled = await Promise.allSettled(sources.map(([, p]) => p));
  const warnings = settled.flatMap((r, i) =>
    r.status === "rejected"
      ? [`${sources[i][0]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`]
      : [],
  );
  const candidates = dedupeById(settled.flatMap((r) => (r.status === "fulfilled" ? r.value : [])));
  const scored = await rankCompetitors(deps.llm, params, candidates);
  await persistCompetitors(deps.db, runId, scored);
  return {
    runId,
    discovered: candidates.length,
    ranked: scored.length,
    topCompetitorId: scored[0]?.id,
    warnings,
  };
}
