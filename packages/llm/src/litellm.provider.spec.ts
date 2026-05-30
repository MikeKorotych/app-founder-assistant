import { OutboundError } from "@hahaton/outbound";
import OpenAI from "openai";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

// Inject a fake gateway client (chat.completions.create under our control).
// `openai` itself stays REAL, so the provider's `instanceof OpenAI.*Error`
// checks run against the genuine SDK error classes.
vi.mock("./gateway-client.factory.js", () => ({
  createGatewayClient: () => ({
    chat: { completions: { create: createMock } },
  }),
}));

import { LiteLlmProvider } from "./litellm.provider";

const provider = (): LiteLlmProvider =>
  new LiteLlmProvider({ baseUrl: "http://gw/v1", apiKey: "sk-x", timeoutMs: 1000 });

const completeReq = {
  systemPrompt: "sys",
  userPrompt: "hi",
  model: "sonnet",
  maxTokens: 100,
  temperature: 0,
};

// Resolve lazily; reject by throwing SYNCHRONOUSLY from the mock — a mock that
// returns a rejected promise gets that promise recorded in mock.results and
// flagged as an unhandled rejection by vitest. Throwing avoids that entirely;
// `await create()` still routes it into the provider's try/catch.
const resolveOnce = (value: unknown) => createMock.mockImplementation(() => Promise.resolve(value));
const throwOnce = (err: unknown) =>
  createMock.mockImplementation(() => {
    throw err;
  });

const errorFrom = async (): Promise<any> => {
  try {
    await provider().complete(completeReq);
    throw new Error("expected the call to throw, but it resolved");
  } catch (err) {
    return err;
  }
};

describe("LiteLlmProvider.complete", () => {
  it("returns content + model on a successful completion", async () => {
    resolveOnce({ choices: [{ message: { content: "hello" } }], model: "sonnet-resolved" });
    const result = await provider().complete(completeReq);
    expect(result).toEqual({ content: "hello", model: "sonnet-resolved" });
  });

  it("raises an unknown-kind OutboundError when the model returns empty content", async () => {
    resolveOnce({ choices: [{ message: { content: "" } }], model: "m" });
    const err = await errorFrom();
    expect(err).toBeInstanceOf(OutboundError);
    expect(err.kind).toBe("unknown");
  });

  it("maps OpenAI.AuthenticationError → OutboundAuthError (non-retryable)", async () => {
    throwOnce(new OpenAI.AuthenticationError(401, undefined, "bad key", undefined));
    const err = await errorFrom();
    expect(err.name).toBe("OutboundAuthError");
    expect(err.kind).toBe("auth");
    expect(err.retryable).toBe(false);
    expect(err.service).toBe("litellm");
  });

  it("maps OpenAI.RateLimitError → OutboundRateLimitError (retryable)", async () => {
    throwOnce(new OpenAI.RateLimitError(429, undefined, "slow down", undefined));
    const err = await errorFrom();
    expect(err.name).toBe("OutboundRateLimitError");
    expect(err.kind).toBe("rate-limit");
    expect(err.retryable).toBe(true);
  });

  it("maps a generic OpenAI.APIError → OutboundTransportError", async () => {
    throwOnce(new OpenAI.APIError(500, undefined, "upstream 500", undefined));
    const err = await errorFrom();
    expect(err.name).toBe("OutboundTransportError");
    expect(err.kind).toBe("transport");
  });

  it("maps an unknown (non-OpenAI) error → OutboundError (kind=unknown)", async () => {
    throwOnce(new Error("socket hang up"));
    const err = await errorFrom();
    expect(err.name).toBe("OutboundError");
    expect(err.kind).toBe("unknown");
  });
});
