import { LiteLlmProvider } from "./litellm.provider";
import type { LlmProvider } from "./llm-provider";

/** Env the gateway reads. Mirrors `.env.example`. */
export interface LlmEnv {
  LLM_GATEWAY_BASE_URL?: string;
  LLM_GATEWAY_API_KEY?: string;
  LLM_TIMEOUT_MS?: string;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Single entry point: build the configured `LlmProvider` from env. Today that's
 * always the LiteLLM gateway; swap the implementation here to change providers.
 */
export function createLlmProvider(env: LlmEnv): LlmProvider {
  const baseUrl = env.LLM_GATEWAY_BASE_URL;
  const apiKey = env.LLM_GATEWAY_API_KEY;
  if (!baseUrl) {
    throw new Error("LLM_GATEWAY_BASE_URL is not set (LiteLLM proxy URL).");
  }
  if (!apiKey) {
    throw new Error("LLM_GATEWAY_API_KEY is not set (LiteLLM master/virtual key).");
  }
  const timeoutMs = env.LLM_TIMEOUT_MS ? Number(env.LLM_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
  return new LiteLlmProvider({ baseUrl, apiKey, timeoutMs });
}
