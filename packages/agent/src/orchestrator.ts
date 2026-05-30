import type { AgentEvent, Run, RunInput } from "@hahaton/contracts";
import type { LlmProvider } from "@hahaton/llm";
import { errorMeta } from "./error-meta";
import {
  briefStep,
  canvasStep,
  competitorsStep,
  gtmStep,
  marketStep,
  risksStep,
  type StepContext,
  synthesisStep,
  unitEconomicsStep,
} from "./steps/index";

/** Model routing — LiteLLM `model_list` aliases. Re-exported for callers. */
export { MODELS } from "@hahaton/llm";

const nowIso = () => new Date().toISOString();

/** Options for {@link runPipeline}. */
export interface RunPipelineOptions {
  /**
   * LLM gateway provider. Build it once from the Worker env with
   * `createLlmProvider(c.env)` (from `@hahaton/llm`) and pass it in.
   */
  llm: LlmProvider;
  /** Called for every streaming event (wire it to SSE). */
  onEvent?: (e: AgentEvent) => void;
}

/**
 * Runs the full Idea → Business Plan pipeline as an orchestrated DAG.
 *
 * `opts.onEvent` is called for every streaming event (wire it to SSE). Every
 * event is also appended to `run.events` so a completed run replays instantly.
 *
 * NOTE: currently sequential. Once steps 1-3 land, parallelize the independent
 * branch (canvas ‖ competitors, risks ‖ gtm) to cut wall-clock — see TODO below.
 */
export async function runPipeline(input: RunInput, opts: RunPipelineOptions): Promise<Run> {
  const { llm, onEvent = () => {} } = opts;

  const run: Run = {
    id: crypto.randomUUID(),
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

  const ctx: StepContext = { run, llm, emit };

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
    emit({ type: "error", ...errorMeta(err), at: nowIso() });
  }

  return run;
}
