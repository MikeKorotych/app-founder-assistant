import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import type { AgentEvent, Run, RunInput } from "../shared/types.js";
import {
  briefStep,
  marketStep,
  competitorsStep,
  canvasStep,
  gtmStep,
  unitEconomicsStep,
  risksStep,
  synthesisStep,
  type StepContext,
} from "./steps/index.js";

/** Model routing — splurge on visible reasoning, save on extraction/utility. */
export const MODELS = {
  opus: "claude-opus-4-8", // market sizing, unit economics, synthesis
  sonnet: "claude-sonnet-4-6", // brief, competitors, canvas, gtm, risks
  haiku: "claude-haiku-4-5-20251001", // utility: input validation, titles
} as const;

const nowIso = () => new Date().toISOString();

/**
 * Runs the full Idea → Business Plan pipeline as an orchestrated DAG.
 *
 * `onEvent` is called for every streaming event (wire it to SSE). Every event
 * is also appended to `run.events` so a completed run replays instantly.
 *
 * NOTE: currently sequential. Once steps 1-3 land, parallelize the independent
 * branch (canvas ‖ competitors, risks ‖ gtm) to cut wall-clock — see TODO below.
 */
export async function runPipeline(
  input: RunInput,
  onEvent: (e: AgentEvent) => void = () => {},
): Promise<Run> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const run: Run = {
    id: randomUUID(),
    input,
    createdAt: nowIso(),
    status: "running",
    citations: [],
    events: [],
  };

  const emit = (e: AgentEvent) => {
    run.events.push(e);
    onEvent(e);
  };

  const ctx: StepContext = { run, client, emit };

  emit({ type: "run_started", runId: run.id, input, at: nowIso() });

  try {
    // Sequential for now. TODO(parallelize): after `brief` + `market`, run
    // [competitors, canvas, gtm, risks] concurrently, then `unitEconomics` and
    // `synthesis` last (they depend on the rest).
    await briefStep(ctx);
    await marketStep(ctx);
    await competitorsStep(ctx);
    await canvasStep(ctx);
    await gtmStep(ctx);
    await unitEconomicsStep(ctx);
    await risksStep(ctx);
    await synthesisStep(ctx);

    run.status = "completed";
    emit({ type: "run_completed", runId: run.id, at: nowIso() });
  } catch (err) {
    run.status = "failed";
    emit({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
      at: nowIso(),
    });
  }

  return run;
}
