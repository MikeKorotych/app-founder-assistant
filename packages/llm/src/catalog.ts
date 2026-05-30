/**
 * Model routing — each value is a `model_name` from the LiteLLM proxy config
 * (`model_list`). It MUST exist there, or the gateway 400s.
 *
 * Routing intent (mirrors the pipeline): splurge on visible reasoning, save on
 * extraction/utility.
 *   opus   → market sizing, unit economics, synthesis
 *   sonnet → brief, competitors, canvas, gtm, risks, search-intent expansion
 *   haiku  → utility: input validation, titles, competitor ranking
 *
 * Values are real `model_name`s from the gateway's `/v1/models` list. Bare
 * `opus`/`haiku` aliases are NOT configured there (they 400) — use the versioned
 * Claude names.
 */
export const MODELS = {
  opus: "claude-opus-4-7",
  sonnet: "claude-sonnet-4-5",
  haiku: "claude-haiku-4-5",
} as const;

export type ModelAlias = (typeof MODELS)[keyof typeof MODELS];
