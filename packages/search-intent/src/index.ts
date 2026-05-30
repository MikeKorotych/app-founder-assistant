/**
 * @hahaton/search-intent — raw UI query → comprehensive, noise-free keywords +
 * categories (via the LiteLLM gateway), for fanning out searches to services.
 */

export type { ExpandOptions } from "./expand";
export { expandSearchIntent } from "./expand";
export { extractJsonObject, parseSearchIntent } from "./parse";
export {
  buildSearchIntentUserPrompt,
  SEARCH_INTENT_SYSTEM_PROMPT,
} from "./prompt";
