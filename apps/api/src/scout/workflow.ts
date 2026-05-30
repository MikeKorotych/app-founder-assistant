import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { createDb } from "@hahaton/db";
import { createLlmProvider } from "@hahaton/llm";
import {
  dedupeById,
  fetchAlternativeTo,
  fetchGooglePlay,
  fetchItunes,
  fetchProductHunt,
  persistCompetitors,
  type RawCompetitor,
  rankCompetitors,
  type ScoutParams,
  type ScoutSummary,
} from "@hahaton/scout";
import type { Bindings } from "../env";

/**
 * Durable competitor-discovery workflow. Each source is its own retried step, so
 * a flaky scraper/API retries with exponential backoff in isolation instead of
 * failing the whole run. Then one ranking step (LLM) and one ingest step (D1).
 */
const SOURCE_RETRY = {
  retries: { limit: 4, delay: "2 seconds" as const, backoff: "exponential" as const },
  timeout: "30 seconds" as const,
};

export class CompetitorDiscoveryWorkflow extends WorkflowEntrypoint<Bindings, ScoutParams> {
  async run(event: WorkflowEvent<ScoutParams>, step: WorkflowStep): Promise<ScoutSummary> {
    const params = event.payload;
    const country = params.country ?? "us";

    // Fan-out: four isolated, independently-retried source steps.
    const [itunes, googleplay, producthunt, alternativeto] = await Promise.all([
      step.do("fetch:itunes", SOURCE_RETRY, () => fetchItunes(params, country)),
      step.do("fetch:googleplay", SOURCE_RETRY, () =>
        fetchGooglePlay(params, this.env.GOOGLE_SEARCH_API_KEY, country),
      ),
      step.do("fetch:producthunt", SOURCE_RETRY, () =>
        fetchProductHunt(params, this.env.PRODUCTHUNT_TOKEN),
      ),
      step.do("fetch:alternativeto", SOURCE_RETRY, () => fetchAlternativeTo(params)),
    ]);

    const candidates: RawCompetitor[] = dedupeById([
      ...itunes,
      ...googleplay,
      ...producthunt,
      ...alternativeto,
    ]);

    // Rank by compatibility with the idea (LLM), then persist (D1 upsert).
    const scored = await step.do(
      "rank",
      { retries: { limit: 2, delay: "5 seconds", backoff: "exponential" }, timeout: "2 minutes" },
      () => rankCompetitors(createLlmProvider(this.env), params, candidates),
    );

    await step.do("ingest", () =>
      persistCompetitors(createDb(this.env.DB), event.instanceId, scored),
    );

    return {
      runId: event.instanceId,
      discovered: candidates.length,
      ranked: scored.length,
      topCompetitorId: scored[0]?.id,
    };
  }
}
