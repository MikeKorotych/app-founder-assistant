/** Worker bindings — D1, secrets, and plain vars from wrangler.jsonc. */
export interface Bindings {
  /** D1 database for run persistence. */
  DB: D1Database;
  /** LiteLLM gateway — the agent routes all LLM calls through it. */
  LLM_GATEWAY_BASE_URL?: string;
  LLM_GATEWAY_API_KEY?: string;
  LLM_TIMEOUT_MS?: string;
  /** Plain vars. */
  APP_ENV?: string;
  SURFACE_BASE_URL?: string;
}

export type BaseEnv = { Bindings: Bindings };

/** Throws if a binding the LLM routes depend on is missing. */
export function requireLlmEnv(env: Bindings): void {
  if (!env.LLM_GATEWAY_BASE_URL) {
    throw new Error("LLM_GATEWAY_BASE_URL is not set (LiteLLM proxy URL).");
  }
  if (!env.LLM_GATEWAY_API_KEY) {
    throw new Error("LLM_GATEWAY_API_KEY is not set (LiteLLM master/virtual key).");
  }
  if (!env.DB) {
    throw new Error("DB binding is not configured (D1).");
  }
}
