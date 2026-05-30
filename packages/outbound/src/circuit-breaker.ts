import { OutboundCircuitOpenError, type OutboundService, shouldTripBreaker } from "./errors.js";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
}

export const DEFAULT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
};

export const CIRCUIT_STATES = {
  closed: "closed",
  open: "open",
  halfOpen: "half-open",
} as const;

export type CircuitState = (typeof CIRCUIT_STATES)[keyof typeof CIRCUIT_STATES];

export interface CircuitBreakerOptions {
  now?: () => number;
}

export class CircuitBreaker {
  private state: CircuitState = CIRCUIT_STATES.closed;
  private failures = 0;
  private lastFailureTime = 0;
  private readonly now: () => number;

  constructor(
    private readonly config: CircuitBreakerConfig,
    private readonly service: OutboundService,
    options: CircuitBreakerOptions = {},
  ) {
    this.now = options.now ?? Date.now;
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CIRCUIT_STATES.open) {
      const elapsed = this.now() - this.lastFailureTime;
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state = CIRCUIT_STATES.halfOpen;
      } else {
        throw new OutboundCircuitOpenError({
          service: this.service,
          context: "circuit-breaker",
          retryAfterMs: this.config.resetTimeoutMs - elapsed,
        });
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      if (shouldTripBreaker(err)) {
        this.onFailure();
      }
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = CIRCUIT_STATES.closed;
  }

  private onFailure(): void {
    this.failures += 1;
    this.lastFailureTime = this.now();
    if (this.state === CIRCUIT_STATES.halfOpen || this.failures >= this.config.failureThreshold) {
      this.state = CIRCUIT_STATES.open;
    }
  }
}
