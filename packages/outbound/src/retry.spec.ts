import {
  OutboundAuthError,
  OutboundRateLimitError,
  OutboundService,
  OutboundTransportError,
} from "./errors.js";
import { computeDelay, DEFAULT_RETRY, withRetry } from "./retry.js";

describe("withRetry", () => {
  const noSleep = (): Promise<void> => Promise.resolve();
  const seededRandom = (): number => 0.5;

  it("returns the result when fn succeeds on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { sleep: noSleep });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient errors up to maxRetries, then succeeds", async () => {
    const transient = new OutboundTransportError({
      service: OutboundService.Litellm,
      context: "x",
      status: 503,
    });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValue("ok");
    const result = await withRetry(fn, {
      config: { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 },
      sleep: noSleep,
      random: seededRandom,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up and throws the last error after maxRetries exhaust", async () => {
    const transient = new OutboundTransportError({
      service: OutboundService.Litellm,
      context: "x",
      status: 503,
    });
    const fn = vi.fn().mockRejectedValue(transient);
    await expect(
      withRetry(fn, {
        config: { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 },
        sleep: noSleep,
        random: seededRandom,
      }),
    ).rejects.toBe(transient);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry on non-transient errors", async () => {
    const auth = new OutboundAuthError({
      service: OutboundService.Litellm,
      context: "x",
    });
    const fn = vi.fn().mockRejectedValue(auth);
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toBe(auth);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("honors retryAfterMs from OutboundRateLimitError over exponential backoff", async () => {
    const rate = new OutboundRateLimitError({
      service: OutboundService.Litellm,
      context: "x",
      retryAfterMs: 7_000,
    });
    const delays: number[] = [];
    const sleep = (ms: number): Promise<void> => {
      delays.push(ms);
      return Promise.resolve();
    };
    const fn = vi.fn().mockRejectedValueOnce(rate).mockResolvedValue("ok");
    await withRetry(fn, {
      config: { maxRetries: 3, baseDelayMs: 1_000, maxDelayMs: 60_000 },
      sleep,
      random: seededRandom,
    });
    expect(delays).toEqual([7_000]);
  });

  it("caps rate-limit retry-after to maxDelayMs", async () => {
    const rate = new OutboundRateLimitError({
      service: OutboundService.Litellm,
      context: "x",
      retryAfterMs: 999_999,
    });
    const delays: number[] = [];
    const sleep = (ms: number): Promise<void> => {
      delays.push(ms);
      return Promise.resolve();
    };
    const fn = vi.fn().mockRejectedValueOnce(rate).mockResolvedValue("ok");
    await withRetry(fn, {
      config: { maxRetries: 3, baseDelayMs: 1_000, maxDelayMs: 60_000 },
      sleep,
      random: seededRandom,
    });
    expect(delays).toEqual([60_000]);
  });

  it("uses exponential backoff for transient errors without explicit retryAfterMs", async () => {
    const transport = new OutboundTransportError({
      service: OutboundService.Litellm,
      context: "x",
      status: 503,
    });
    const delays: number[] = [];
    const sleep = (ms: number): Promise<void> => {
      delays.push(ms);
      return Promise.resolve();
    };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(transport)
      .mockRejectedValueOnce(transport)
      .mockResolvedValue("ok");
    await withRetry(fn, {
      config: { maxRetries: 3, baseDelayMs: 1_000, maxDelayMs: 60_000 },
      sleep,
      random: seededRandom,
    });
    expect(delays).toHaveLength(2);
    expect(delays[0]).toBeGreaterThanOrEqual(1_000);
    expect(delays[1]).toBeGreaterThan(delays[0]!);
  });
});

describe("computeDelay", () => {
  it("returns retryAfterMs when OutboundRateLimitError carries one", () => {
    const err = new OutboundRateLimitError({
      service: OutboundService.Litellm,
      context: "x",
      retryAfterMs: 4_500,
    });
    expect(computeDelay(0, err, DEFAULT_RETRY)).toBe(4_500);
  });

  it("falls back to exponential + jitter when error has no retryAfterMs", () => {
    const err = new OutboundTransportError({
      service: OutboundService.Litellm,
      context: "x",
      status: 503,
    });
    const delay = computeDelay(
      0,
      err,
      { maxRetries: 3, baseDelayMs: 1_000, maxDelayMs: 60_000 },
      () => 0.5,
    );
    expect(delay).toBe(1_000 + 250);
  });

  it("grows exponentially across attempts", () => {
    const err = new OutboundTransportError({
      service: OutboundService.Litellm,
      context: "x",
      status: 503,
    });
    const cfg = { maxRetries: 5, baseDelayMs: 100, maxDelayMs: 60_000 };
    const d0 = computeDelay(0, err, cfg, () => 0);
    const d1 = computeDelay(1, err, cfg, () => 0);
    const d2 = computeDelay(2, err, cfg, () => 0);
    expect(d0).toBe(100);
    expect(d1).toBe(200);
    expect(d2).toBe(400);
  });
});
