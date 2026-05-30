import {
  OutboundAuthError,
  OutboundRateLimitError,
  OutboundService,
  OutboundTransportError,
} from "./errors.js";
import { OutboundHttpClient, type OutboundHttpClientConfig } from "./outbound-http.client.js";

class TestClient extends OutboundHttpClient {
  callGet<T>(path: string, query?: Record<string, string>): Promise<T> {
    return this.get<T>(path, { query, context: `GET ${path}` });
  }
  callPost<T>(path: string, body: unknown): Promise<T> {
    return this.post<T>(path, body, { context: `POST ${path}` });
  }
  callDelete<T>(path: string): Promise<T> {
    return this.delete<T>(path, { context: `DELETE ${path}` });
  }
}

const mockResponse = (init: {
  status: number;
  body?: unknown;
  text?: string;
  headers?: Record<string, string>;
}): Response => {
  const headers = new Headers(init.headers ?? {});
  const ok = init.status >= 200 && init.status < 300;
  return {
    ok,
    status: init.status,
    headers,
    json: vi.fn().mockResolvedValue(init.body ?? {}),
    text: vi
      .fn()
      .mockResolvedValue(
        init.text ?? (typeof init.body === "string" ? init.body : JSON.stringify(init.body ?? {})),
      ),
  } as unknown as Response;
};

const baseConfig = (
  overrides: Partial<OutboundHttpClientConfig> = {},
): OutboundHttpClientConfig => ({
  baseUrl: "https://api.test.example",
  service: OutboundService.Litellm,
  breaker: null,
  retry: { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 10 },
  ...overrides,
});

describe("OutboundHttpClient", () => {
  it("GET returns parsed JSON on 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ status: 200, body: { id: "x" } }));
    const client = new TestClient(baseConfig({ fetchImpl }));
    const result = await client.callGet<{ id: string }>("/candidates");
    expect(result).toEqual({ id: "x" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [calledUrl] = fetchImpl.mock.calls[0];
    expect(calledUrl).toBe("https://api.test.example/candidates");
  });

  it("appends query params to the URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ status: 200, body: [] }));
    const client = new TestClient(baseConfig({ fetchImpl }));
    await client.callGet("/candidates", { cursor: "abc", limit: "50" });
    const [calledUrl] = fetchImpl.mock.calls[0];
    expect(calledUrl).toContain("cursor=abc");
    expect(calledUrl).toContain("limit=50");
  });

  it("POST sends JSON-serialized body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ status: 201, body: { id: "new" } }));
    const client = new TestClient(baseConfig({ fetchImpl }));
    await client.callPost("/candidates", { name: "Alice" });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"name":"Alice"}');
  });

  it("returns undefined for 204 No Content", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ status: 204 }));
    const client = new TestClient(baseConfig({ fetchImpl }));
    const result = await client.callDelete("/candidates/abc");
    expect(result).toBeUndefined();
  });

  it("maps 401 to OutboundAuthError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ status: 401, text: "bad token" }));
    const client = new TestClient(baseConfig({ fetchImpl }));
    await expect(client.callGet("/candidates")).rejects.toBeInstanceOf(OutboundAuthError);
  });

  it("maps 403 to OutboundAuthError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ status: 403, text: "forbidden" }));
    const client = new TestClient(baseConfig({ fetchImpl }));
    await expect(client.callGet("/candidates")).rejects.toBeInstanceOf(OutboundAuthError);
  });

  it("maps 429 to OutboundRateLimitError with Retry-After header parsed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      mockResponse({
        status: 429,
        text: "slow down",
        headers: { "retry-after": "7" },
      }),
    );
    const client = new TestClient(baseConfig({ fetchImpl }));
    try {
      await client.callGet("/candidates");
    } catch (err) {
      expect(err).toBeInstanceOf(OutboundRateLimitError);
      expect((err as OutboundRateLimitError).retryAfterMs).toBe(7_000);
    }
  });

  it("maps 5xx to OutboundTransportError (retryable)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ status: 503, text: "down" }));
    const client = new TestClient(baseConfig({ fetchImpl }));
    try {
      await client.callGet("/candidates");
    } catch (err) {
      expect(err).toBeInstanceOf(OutboundTransportError);
      expect((err as OutboundTransportError).retryable).toBe(true);
      expect((err as OutboundTransportError).status).toBe(503);
    }
  });

  it("honors errorMapper override before falling back to default mapping", async () => {
    const fetchImpl = vi.fn();
    const errorMapper = vi.fn();
    const client = new TestClient(baseConfig({ fetchImpl, errorMapper }));
    fetchImpl.mockResolvedValueOnce(mockResponse({ status: 500, text: '{"code":"BAD_TOKEN"}' }));
    errorMapper.mockReturnValueOnce(
      new OutboundAuthError({
        service: OutboundService.Litellm,
        context: "override",
        message: "bad token",
      }),
    );
    await expect(client.callGet("/candidates")).rejects.toBeInstanceOf(OutboundAuthError);
  });

  it("wraps unknown fetch failures as retryable OutboundTransportError", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const client = new TestClient(baseConfig({ fetchImpl }));
    try {
      await client.callGet("/candidates");
    } catch (err) {
      expect(err).toBeInstanceOf(OutboundTransportError);
      expect((err as OutboundTransportError).retryable).toBe(true);
    }
  });

  it("wraps AbortError as retryable OutboundTransportError", async () => {
    const abortErr = new Error("aborted");
    abortErr.name = "AbortError";
    const fetchImpl = vi.fn().mockRejectedValue(abortErr);
    const client = new TestClient(baseConfig({ fetchImpl }));
    try {
      await client.callGet("/candidates");
    } catch (err) {
      expect(err).toBeInstanceOf(OutboundTransportError);
      expect((err as OutboundTransportError).message).toContain("timed out");
    }
  });

  it("attaches Authorization header when authHeaderBuilder returns a value", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ status: 200, body: {} }));
    const client = new TestClient(
      baseConfig({ fetchImpl, authHeaderBuilder: () => "Bearer test-token" }),
    );
    await client.callGet("/candidates");
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("omits Authorization header when authHeaderBuilder returns null", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(mockResponse({ status: 200, body: {} }));
    const client = new TestClient(baseConfig({ fetchImpl, authHeaderBuilder: () => null }));
    await client.callGet("/candidates");
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });
});
