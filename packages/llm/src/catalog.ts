/**
 * Model routing — each value is a `model_name` from the LiteLLM proxy config
 * (`model_list`). It MUST exist there, or the gateway 400s.
 *
 * Routing intent (mirrors the pipeline): splurge on visible reasoning, save on
 * extraction/utility.
 *   opus   → market sizing, unit economics, synthesis
 *   sonnet → brief, competitors, canvas, gtm, risks, search-intent expansion
 *   haiku  → utility: input validation, titles
 *
 * NOTE: `sonnet` is wired to Claude Sonnet 4.5. Replace `opus`/`haiku` with the
 * real `model_name`s once those entries are added to the LiteLLM config.
 */
export const MODELS = {
  opus: "opus",
  sonnet: "claude-sonnet-4-5",
  haiku: "haiku",
} as const;

export type ModelAlias = (typeof MODELS)[keyof typeof MODELS];
