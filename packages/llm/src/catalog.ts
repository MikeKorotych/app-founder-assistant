/**
 * Model routing — LiteLLM `model_list` aliases (NOT Anthropic-native IDs).
 * Each alias here MUST exist in the LiteLLM proxy config, or the gateway 400s.
 *
 * Routing intent (mirrors the pipeline): splurge on visible reasoning, save on
 * extraction/utility.
 *   opus   → market sizing, unit economics, synthesis
 *   sonnet → brief, competitors, canvas, gtm, risks
 *   haiku  → utility: input validation, titles
 */
export const MODELS = {
  opus: "opus",
  sonnet: "sonnet",
  haiku: "haiku",
} as const;

export type ModelAlias = (typeof MODELS)[keyof typeof MODELS];
