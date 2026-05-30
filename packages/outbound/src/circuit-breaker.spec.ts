import { CIRCUIT_STATES, CircuitBreaker, type CircuitBreakerConfig } from "./circuit-breaker.js";
import {
  OutboundAuthError,
  OutboundCircuitOpenError,
  OutboundRateLimitError,
  OutboundService,
  OutboundTransportError,
} from "./errors.js";

const cfg: CircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 1_000,
};

const makeBreaker = (
  override: Partial<CircuitBreakerConfig> = {},
  initialNow = 1_000_000,
): { breaker: CircuitBreaker; advance: (ms: number) => void } => {
  let current = initialNow;
  const now = (): number => current;
  const breaker = new CircuitBreaker({ ...cfg, ...override }, OutboundService.Litellm, { now });
  return { breaker, advance: (ms) => (current += ms) };
};

const transient = (): OutboundTransportError =>
  new OutboundTransportError({
    service: OutboundService.Litellm,
    context: "x",
    status: 503,
  });

describe("CircuitBreaker", () => {
  it("starts closed", () => {
    const { breaker } = makeBreaker();
    expect(breaker.getState()).toBe(CIRCUIT_STATES.closed);
  });

  it("lets calls through when closed and counts consecutive failures", async () => {
    const { breaker } = makeBreaker();
    const fn = vi.fn().mockRejectedValue(transient());
    for (let i = 0; i < 2; i++) {
      await expect(breaker.execute(fn)).rejects.toBeInstanceOf(OutboundTransportError);
    }
    expect(breaker.getState()).toBe(CIRCUIT_STATES.closed);
    expect(breaker.getFailureCount()).toBe(2);
  });

  it("opens once failureThreshold is reached", async () => {
    const { breaker } = makeBreaker();
    const fn = vi.fn().mockRejectedValue(transient());
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toBeInstanceOf(OutboundTransportError);
    }
    expect(breaker.getState()).toBe(CIRCUIT_STATES.open);
  });

  it("rejects immediately with OutboundCircuitOpenError while open within cooldown", async () => {
    const { breaker, advance } = makeBreaker();
    const fn = vi.fn().mockRejectedValue(transient());
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toBeTruthy();
    }
    advance(500);
    const probe = vi.fn().mockResolvedValue("should not run");
    await expect(breaker.execute(probe)).rejects.toBeInstanceOf(OutboundCircuitOpenError);
    expect(probe).not.toHaveBeenCalled();
  });

  it("transitions to half-open after cooldown elapses, allowing a probe call", async () => {
    const { breaker, advance } = makeBreaker();
    const fn = vi.fn().mockRejectedValue(transient());
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toBeTruthy();
    }
    advance(1_500);
    const probe = vi.fn().mockResolvedValue("ok");
    const result = await breaker.execute(probe);
    expect(result).toBe("ok");
    expect(breaker.getState()).toBe(CIRCUIT_STATES.closed);
  });

  it("returns to open immediately on a half-open probe failure (EC-005)", async () => {
    const { breaker, advance } = makeBreaker();
    const fn = vi.fn().mockRejectedValue(transient());
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fn)).rejects.toBeTruthy();
    }
    advance(1_500);
    await expect(breaker.execute(fn)).rejects.toBeInstanceOf(OutboundTransportError);
    expect(breaker.getState()).toBe(CIRCUIT_STATES.open);
    const probe = vi.fn().mockResolvedValue("should not run");
    await expect(breaker.execute(probe)).rejects.toBeInstanceOf(OutboundCircuitOpenError);
  });

  it("does NOT count rate-limit errors as breaker failures (EC-001)", async () => {
    const { breaker } = makeBreaker();
    const rate = new OutboundRateLimitError({
      service: OutboundService.Litellm,
      context: "x",
      retryAfterMs: 5_000,
    });
    const fn = vi.fn().mockRejectedValue(rate);
    for (let i = 0; i < 10; i++) {
      await expect(breaker.execute(fn)).rejects.toBeInstanceOf(OutboundRateLimitError);
    }
    expect(breaker.getState()).toBe(CIRCUIT_STATES.closed);
    expect(breaker.getFailureCount()).toBe(0);
  });

  it("does NOT count auth errors as breaker failures (re-trying will not fix credentials)", async () => {
    const { breaker } = makeBreaker();
    const auth = new OutboundAuthError({
      service: OutboundService.Litellm,
      context: "x",
    });
    const fn = vi.fn().mockRejectedValue(auth);
    for (let i = 0; i < 10; i++) {
      await expect(breaker.execute(fn)).rejects.toBeInstanceOf(OutboundAuthError);
    }
    expect(breaker.getFailureCount()).toBe(0);
  });

  it("resets the failure counter on a successful call", async () => {
    const { breaker } = makeBreaker();
    const failOnce = vi.fn().mockRejectedValueOnce(transient()).mockResolvedValue("ok");
    await expect(breaker.execute(failOnce)).rejects.toBeTruthy();
    expect(breaker.getFailureCount()).toBe(1);
    await breaker.execute(failOnce);
    expect(breaker.getFailureCount()).toBe(0);
  });
});
