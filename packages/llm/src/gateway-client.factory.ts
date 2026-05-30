import OpenAI from "openai";

export interface GatewayClientConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

/**
 * Builds the openai SDK client pointed at the LiteLLM proxy. The SDK's built-in
 * retry stays on (LLM calls don't go through OutboundHttpClient's retry/breaker
 * — see the package PLAN, decision D-002).
 */
export function createGatewayClient(config: GatewayClientConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    timeout: config.timeoutMs,
  });
}
