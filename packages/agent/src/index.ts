/**
 * @hahaton/agent — the Idea → Business Plan agent pipeline.
 *
 * - `runPipeline` runs the full orchestrated DAG and streams `AgentEvent`s.
 * - `runAgent` is the minimal single-turn helper.
 * - The individual steps and `StepContext` are re-exported for testing / reuse.
 */
export { runPipeline, MODELS } from "./orchestrator.js";
export { runAgent } from "./simple.js";
export * from "./steps/index.js";
