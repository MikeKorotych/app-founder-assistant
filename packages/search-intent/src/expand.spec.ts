import { type LlmProvider, type LlmRequest, MODELS } from "@hahaton/llm";
import { expandSearchIntent } from "./expand";

/** Fake provider — records the last request and returns canned content. */
function fakeLlm(content: string): { llm: LlmProvider; calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  const llm: LlmProvider = {
    name: "fake",
    complete: async (req) => {
      calls.push(req);
      return { content, model: "claude-sonnet-4-5" };
    },
    chat: async () => {
      throw new Error("chat() should not be used by expandSearchIntent");
    },
  };
  return { llm, calls };
}

describe("expandSearchIntent", () => {
  it("returns normalized keywords + categories from the model JSON", async () => {
    const { llm } = fakeLlm('{"keywords":["crm","sales crm"],"categories":["b2b software"]}');
    const result = await expandSearchIntent({ query: "crm for startups" }, llm);
    expect(result).toEqual({ keywords: ["crm", "sales crm"], categories: ["b2b software"] });
  });

  it("passes the query (and locale) into the user prompt, with the system prompt", async () => {
    const { llm, calls } = fakeLlm('{"keywords":[],"categories":[]}');
    await expandSearchIntent({ query: "habit tracker", locale: "uk" }, llm);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.userPrompt).toContain("habit tracker");
    expect(calls[0]!.userPrompt).toContain("uk");
    expect(calls[0]!.systemPrompt).toContain('{"keywords": string[], "categories": string[]}');
    expect(calls[0]!.temperature).toBe(0);
  });

  it("defaults to the catalog Sonnet alias and allows a model override", async () => {
    const { llm, calls } = fakeLlm('{"keywords":[],"categories":[]}');
    await expandSearchIntent({ query: "x" }, llm);
    expect(calls[0]!.model).toBe(MODELS.sonnet);

    await expandSearchIntent({ query: "x" }, llm, { model: "opus" });
    expect(calls[1]!.model).toBe("opus");
  });

  it("tolerates fenced model output", async () => {
    const { llm } = fakeLlm('```json\n{"keywords":["a"],"categories":["b"]}\n```');
    const result = await expandSearchIntent({ query: "x" }, llm);
    expect(result).toEqual({ keywords: ["a"], categories: ["b"] });
  });
});
