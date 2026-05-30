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

/** A source's outcome: its competitors, plus a warning if it gave up. */
interface SourceResult {
  items: RawCompetitor[];
  warning?: string;
}

/**
 * Run one source as a retried step and contain its failure. After the retry
 * limit is exhausted the step throws — we catch it here so a single dead source
 * (e.g. AlternativeTo 403) degrades to an empty result + a warning instead of
 * failing the whole run. Sources that succeed are unaffected.
 */
async function runSource(
  step: WorkflowStep,
  name: string,
  fetcher: () => Promise<RawCompetitor[]>,
): Promise<SourceResult> {
  try {
    const items = await step.do(`fetch:${name}`, SOURCE_RETRY, fetcher);
    return { items };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`scout: source "${name}" failed after retries — ${message}`);
    return { items: [], warning: `${name}: ${message}` };
  }
}

export class CompetitorDiscoveryWorkflow extends WorkflowEntrypoint<Bindings, ScoutParams> {
  async run(event: WorkflowEvent<ScoutParams>, step: WorkflowStep): Promise<ScoutSummary> {
    const params = event.payload;
    const country = params.country ?? "us";

    // Fan-out: four isolated, independently-retried source steps. A source that
    // exhausts its retries contributes [] + a warning rather than aborting the run.
    const results = await Promise.all([
      runSource(step, "itunes", () => fetchItunes(params, country)),
      runSource(step, "googleplay", () =>
        fetchGooglePlay(params, this.env.GOOGLE_SEARCH_API_KEY, country),
      ),
      runSource(step, "producthunt", () => fetchProductHunt(params, this.env.PRODUCTHUNT_TOKEN)),
      runSource(step, "alternativeto", () => fetchAlternativeTo(params)),
    ]);

    const warnings = results.map((r) => r.warning).filter((w): w is string => w !== undefined);
    const candidates: RawCompetitor[] = dedupeById(results.flatMap((r) => r.items));

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
      warnings,
    };
  }
}
