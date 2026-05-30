/**
 * @hahaton/agent — the Idea → Business Plan agent pipeline.
 *
 * - `runPipeline` runs the full orchestrated DAG and streams `AgentEvent`s.
 * - `runAgent` is the minimal single-turn helper.
 * - The individual steps and `StepContext` are re-exported for testing / reuse.
 */

export type { RunPipelineOptions } from "./orchestrator";
export { MODELS, runPipeline } from "./orchestrator";
export { runAgent } from "./simple";
export * from "./steps/index";
