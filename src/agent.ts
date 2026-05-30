import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";
const SYSTEM_PROMPT = "You are a helpful assistant.";

/**
 * Minimal single-turn agent call. Extend this with tool definitions and a
 * tool-use loop to make it genuinely agentic.
 */
export async function runAgent(prompt: string): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { text: string }).text)
    .join("\n");
}
