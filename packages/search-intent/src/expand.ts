import type { SearchIntent, SearchIntentInput } from "@hahaton/contracts";
import { type LlmProvider, MODELS } from "@hahaton/llm";
import { parseSearchIntent } from "./parse";
import { buildSearchIntentUserPrompt, SEARCH_INTENT_SYSTEM_PROMPT } from "./prompt";

export interface ExpandOptions {
  /** LiteLLM model alias. Defaults to `MODELS.sonnet` (Claude Sonnet 4.5). */
  model?: string;
  /** Token budget for the completion. */
  maxTokens?: number;
}

/**
 * Expands a raw UI search query into comprehensive, noise-free keywords +
 * categories via the LLM gateway. Build the provider once from the Worker env
 * with `createLlmProvider(c.env)` and pass it in.
 */
export async function expandSearchIntent(
  input: SearchIntentInput,
  llm: LlmProvider,
  opts: ExpandOptions = {},
): Promise<SearchIntent> {
  const { content } = await llm.complete({
    systemPrompt: SEARCH_INTENT_SYSTEM_PROMPT,
    userPrompt: buildSearchIntentUserPrompt(input),
    model: opts.model ?? MODELS.sonnet,
    maxTokens: opts.maxTokens ?? 1024,
    temperature: 0,
  });
  return parseSearchIntent(content);
}
