/**
 * Model routing — each value is the model id the configured gateway expects.
 *
 * Provider = OpenRouter (OpenAI-compatible). Set in env:
 *   LLM_GATEWAY_BASE_URL = https://openrouter.ai/api/v1
 *   LLM_GATEWAY_API_KEY  = <your OpenRouter key>
 * Model ids below are OpenRouter ids. Defaulted to cheap DeepSeek v4 to keep
 * cost ~$0 (flash ≈ $0.10/M in). Bump specific slots to a stronger model
 * (e.g. anthropic/claude-sonnet-4.5) when quality matters — verify ids at
 * https://openrouter.ai/models.
 *
 * Routing intent: splurge on visible reasoning, save on extraction/utility.
 *   opus   → market sizing, unit economics, synthesis
 *   sonnet → brief, competitors, canvas, gtm, risks, search-intent, opportunity
 *   haiku  → utility: input validation, titles, competitor ranking
 */
export const MODELS = {
  opus: "deepseek/deepseek-v4-pro",
  sonnet: "deepseek/deepseek-v4-flash",
  haiku: "deepseek/deepseek-v4-flash",
} as const;

export type ModelAlias = (typeof MODELS)[keyof typeof MODELS];
