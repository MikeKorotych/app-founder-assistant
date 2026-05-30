import { type LlmProvider, MODELS } from "@hahaton/llm";

const SYSTEM_PROMPT = "You are a helpful assistant.";

/**
 * Minimal single-turn agent call. Extend this with tool definitions and a
 * tool-use loop to make it genuinely agentic, or use `runPipeline` for the
 * full Idea → Business Plan workflow.
 *
 * Pass an `LlmProvider` built from the Worker env via `createLlmProvider(c.env)`.
 */
export async function runAgent(prompt: string, llm: LlmProvider): Promise<string> {
  const { content } = await llm.complete({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: prompt,
    model: MODELS.sonnet,
    maxTokens: 1024,
    temperature: 0,
  });
  return content;
}
