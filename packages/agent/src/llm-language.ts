import type {
  LlmChatRequest,
  LlmChatResponse,
  LlmProvider,
  LlmRequest,
  LlmResponse,
} from "@hahaton/llm";

/**
 * Forces the pipeline's free-text output to Ukrainian without translating
 * structure. Applied by wrapping the provider in the orchestrator, so it's
 * scoped to the report-generating steps (NOT to search-intent / scout ranking,
 * which need their original-language terms).
 *
 * The directive is careful to preserve JSON shape, enum values, units, numbers,
 * URLs and proper nouns — only human-readable prose is translated.
 */
export const OUTPUT_LANGUAGE_DIRECTIVE =
  "OUTPUT LANGUAGE: write every natural-language value in Ukrainian (українською мовою). " +
  "Keep the JSON structure, field keys, enum values (e.g. \"low\"/\"medium\"/\"high\", \"top-down\"), " +
  "numbers, units, currency codes, URLs, dates and proper nouns (brand / product / company / model names) " +
  "exactly as required — do NOT translate or alter them. Only human-readable prose — titles, descriptions, " +
  "rationale, summaries, narrative — must be in Ukrainian.";

const append = (base: string, directive: string): string =>
  base ? `${base}\n\n${directive}` : directive;

/** Returns a provider whose every call appends the Ukrainian output directive. */
export function withOutputLanguage(
  llm: LlmProvider,
  directive: string = OUTPUT_LANGUAGE_DIRECTIVE,
): LlmProvider {
  return {
    name: llm.name,
    complete(request: LlmRequest): Promise<LlmResponse> {
      return llm.complete({ ...request, systemPrompt: append(request.systemPrompt, directive) });
    },
    chat(request: LlmChatRequest): Promise<LlmChatResponse> {
      const messages = [...request.messages];
      const sysIdx = messages.findIndex((m) => m.role === "system");
      if (sysIdx >= 0 && typeof messages[sysIdx].content === "string") {
        messages[sysIdx] = {
          ...messages[sysIdx],
          content: append(messages[sysIdx].content as string, directive),
        };
      } else {
        messages.unshift({ role: "system", content: directive });
      }
      return llm.chat({ ...request, messages });
    },
  };
}
