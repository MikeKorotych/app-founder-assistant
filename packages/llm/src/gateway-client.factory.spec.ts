const { openaiCtor } = vi.hoisted(() => ({ openaiCtor: vi.fn() }));

vi.mock("openai", () => ({
  __esModule: true,
  default: vi.fn().mockImplementation((opts: unknown) => {
    openaiCtor(opts);
    return { opts };
  }),
}));

import { createGatewayClient } from "./gateway-client.factory";

describe("createGatewayClient", () => {
  beforeEach(() => openaiCtor.mockClear());

  it("builds an OpenAI client from base URL + key + timeout", () => {
    createGatewayClient({
      baseUrl: "http://gw/v1",
      apiKey: "sk-x",
      timeoutMs: 1234,
    });
    expect(openaiCtor).toHaveBeenCalledWith({
      apiKey: "sk-x",
      baseURL: "http://gw/v1",
      timeout: 1234,
    });
  });
});
