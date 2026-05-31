/**
 * Model routing — each value is the model id the configured gateway expects.
 *
 * Provider = OpenRouter (OpenAI-compatible). Set in env:
 *   LLM_GATEWAY_BASE_URL = https://openrouter.ai/api/v1
 *   LLM_GATEWAY_API_KEY  = <your OpenRouter key>
 * Model ids below are OpenRouter ids (`provider/model`). OpenRouter versions
 * these often — VERIFY the exact current ids at https://openrouter.ai/models
 * (a wrong id 400s). To go back to a LiteLLM proxy, swap these for its model_names.
 *
 * Routing intent: splurge on visible reasoning, save on extraction/utility.
 *   opus   → market sizing, unit economics, synthesis
 *   sonnet → brief, competitors, canvas, gtm, risks, search-intent, opportunity
 *   haiku  → utility: input validation, titles, competitor ranking
 */
export const MODELS = {
  opus: "anthropic/claude-opus-4.1",
  sonnet: "anthropic/claude-sonnet-4.5",
  haiku: "anthropic/claude-haiku-4.5",
} as const;

export type ModelAlias = (typeof MODELS)[keyof typeof MODELS];
