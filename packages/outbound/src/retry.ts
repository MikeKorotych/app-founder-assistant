import { isTransientError, OutboundRateLimitError } from "./errors.js";

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
};

export interface WithRetryOptions {
  config?: RetryConfig;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions = {},
): Promise<T> {
  const config = options.config ?? DEFAULT_RETRY;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  let lastError: unknown;
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= config.maxRetries || !isTransientError(err)) throw err;
      const delay = computeDelay(attempt, err, config, random);
      await sleep(delay);
    }
  }
  throw lastError;
}

export function computeDelay(
  attempt: number,
  err: unknown,
  config: RetryConfig,
  random: () => number = Math.random,
): number {
  if (err instanceof OutboundRateLimitError && err.retryAfterMs !== null) {
    return Math.min(err.retryAfterMs, config.maxDelayMs);
  }
  const exp = config.baseDelayMs * 2 ** attempt;
  const jitter = random() * (config.baseDelayMs * 0.5);
  return Math.min(exp + jitter, config.maxDelayMs);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
