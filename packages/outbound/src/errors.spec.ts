import {
  isTransientError,
  OutboundAuthError,
  OutboundCircuitOpenError,
  OutboundError,
  OutboundErrorKind,
  OutboundMappingError,
  OutboundRateLimitError,
  OutboundService,
  OutboundTransportError,
  shouldTripBreaker,
} from "./errors.js";

describe("OutboundError", () => {
  it("carries service, kind, retryable, context, and cause", () => {
    const cause = new Error("inner");
    const err = new OutboundError({
      service: OutboundService.Litellm,
      kind: OutboundErrorKind.Transport,
      retryable: true,
      context: "POST /chat/completions",
      message: "boom",
      cause,
    });
    expect(err.service).toBe(OutboundService.Litellm);
    expect(err.kind).toBe("transport");
    expect(err.retryable).toBe(true);
    expect(err.context).toBe("POST /chat/completions");
    expect(err.cause).toBe(cause);
    expect(err.message).toBe("boom");
  });

  it("sets name to the concrete subclass for instanceof checks", () => {
    const err = new OutboundAuthError({
      service: OutboundService.Litellm,
      context: "login",
    });
    expect(err.name).toBe("OutboundAuthError");
    expect(err instanceof OutboundError).toBe(true);
    expect(err instanceof OutboundAuthError).toBe(true);
  });
});

describe("OutboundRateLimitError", () => {
  it("is retryable and exposes retryAfterMs", () => {
    const err = new OutboundRateLimitError({
      service: OutboundService.Litellm,
      context: "POST /chat/completions",
      retryAfterMs: 5000,
    });
    expect(err.kind).toBe("rate-limit");
    expect(err.retryable).toBe(true);
    expect(err.retryAfterMs).toBe(5000);
  });

  it("allows null retryAfterMs when the service does not provide it", () => {
    const err = new OutboundRateLimitError({
      service: OutboundService.Litellm,
      context: "POST /chat/completions",
      retryAfterMs: null,
    });
    expect(err.retryAfterMs).toBeNull();
  });
});

describe("OutboundAuthError", () => {
  it("is non-retryable by construction", () => {
    const err = new OutboundAuthError({
      service: OutboundService.Litellm,
      context: "callback",
    });
    expect(err.retryable).toBe(false);
  });
});

describe("OutboundTransportError", () => {
  it("defaults retryable to true for 5xx status codes", () => {
    const err = new OutboundTransportError({
      service: OutboundService.Litellm,
      context: "POST /chat/completions",
      status: 503,
    });
    expect(err.retryable).toBe(true);
  });

  it("defaults retryable to false for 4xx status codes", () => {
    const err = new OutboundTransportError({
      service: OutboundService.Litellm,
      context: "POST /chat/completions",
      status: 400,
    });
    expect(err.retryable).toBe(false);
  });

  it("honors explicit retryable override", () => {
    const err = new OutboundTransportError({
      service: OutboundService.Litellm,
      context: "POST /chat/completions",
      status: 500,
      retryable: false,
    });
    expect(err.retryable).toBe(false);
  });
});

describe("OutboundMappingError", () => {
  it("is non-retryable — a malformed payload will not be repaired by retry", () => {
    const err = new OutboundMappingError({
      service: OutboundService.Litellm,
      context: "normalizeCompletion",
      cause: new Error("missing id"),
    });
    expect(err.retryable).toBe(false);
    expect(err.kind).toBe("mapping");
  });
});

describe("OutboundCircuitOpenError", () => {
  it("exposes retryAfterMs for the cooldown window", () => {
    const err = new OutboundCircuitOpenError({
      service: OutboundService.Litellm,
      context: "circuit-breaker",
      retryAfterMs: 12_000,
    });
    expect(err.retryAfterMs).toBe(12_000);
    expect(err.kind).toBe("breaker-open");
    expect(err.retryable).toBe(false);
  });
});

describe("isTransientError", () => {
  it("returns true for retryable OutboundError", () => {
    const err = new OutboundTransportError({
      service: OutboundService.Litellm,
      context: "x",
      status: 503,
    });
    expect(isTransientError(err)).toBe(true);
  });

  it("returns false for non-retryable OutboundError", () => {
    const err = new OutboundAuthError({
      service: OutboundService.Litellm,
      context: "x",
    });
    expect(isTransientError(err)).toBe(false);
  });

  it("returns true for AbortError (timeout)", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(isTransientError(err)).toBe(true);
  });

  it("returns true for TypeError (fetch network failure)", () => {
    expect(isTransientError(new TypeError("fetch failed"))).toBe(true);
  });

  it("returns false for unknown errors", () => {
    expect(isTransientError(new RangeError("out of range"))).toBe(false);
    expect(isTransientError("not even an error")).toBe(false);
  });
});

describe("shouldTripBreaker", () => {
  it("returns true for retryable transport errors (5xx, network)", () => {
    const err = new OutboundTransportError({
      service: OutboundService.Litellm,
      context: "x",
      status: 503,
    });
    expect(shouldTripBreaker(err)).toBe(true);
  });

  it("returns false for rate-limit errors (upstream backpressure, not breakage)", () => {
    const err = new OutboundRateLimitError({
      service: OutboundService.Litellm,
      context: "x",
      retryAfterMs: 5000,
    });
    expect(shouldTripBreaker(err)).toBe(false);
  });

  it("returns false for circuit-open errors (already-open does not re-trip)", () => {
    const err = new OutboundCircuitOpenError({
      service: OutboundService.Litellm,
      context: "x",
      retryAfterMs: 30_000,
    });
    expect(shouldTripBreaker(err)).toBe(false);
  });

  it("returns false for auth errors (re-trying will not fix bad credentials)", () => {
    const err = new OutboundAuthError({
      service: OutboundService.Litellm,
      context: "x",
    });
    expect(shouldTripBreaker(err)).toBe(false);
  });

  it("returns true for AbortError (timeout signals upstream slowness)", () => {
    const err = new Error("timeout");
    err.name = "AbortError";
    expect(shouldTripBreaker(err)).toBe(true);
  });
});
