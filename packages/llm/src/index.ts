/**
 * @hahaton/llm — the LiteLLM gateway provider.
 *
 * The pipeline depends on the `LlmProvider` seam and `createLlmProvider`; the
 * concrete `LiteLlmProvider` (openai SDK → LiteLLM proxy) is an implementation
 * detail. Error taxonomy is shared with `@hahaton/outbound`.
 */

export type { ModelAlias } from "./catalog";
export { MODELS } from "./catalog";
export type { LlmEnv } from "./factory";
export { createLlmProvider } from "./factory";
export type { GatewayClientConfig } from "./gateway-client.factory";
export { createGatewayClient } from "./gateway-client.factory";
export { LiteLlmProvider } from "./litellm.provider";
export * from "./llm-provider";
