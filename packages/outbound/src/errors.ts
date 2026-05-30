export const OutboundErrorKind = {
  RateLimit: "rate-limit",
  Auth: "auth",
  Transport: "transport",
  Mapping: "mapping",
  BreakerOpen: "breaker-open",
  Unknown: "unknown",
} as const;

export type OutboundErrorKind = (typeof OutboundErrorKind)[keyof typeof OutboundErrorKind];

/**
 * Every outbound integration registers its id here (PascalCase key → kebab value,
 * sorted alphabetically). Add a new entry the moment you add an integration so
 * its errors are attributable. Currently only the LiteLLM gateway lives here.
 */
export const OutboundService = {
  Litellm: "litellm",
} as const;

export type OutboundService = (typeof OutboundService)[keyof typeof OutboundService];

export interface OutboundErrorArgs {
  service: OutboundService;
  kind: OutboundErrorKind;
  retryable: boolean;
  context: string;
  message: string;
  cause?: unknown;
}

export class OutboundError extends Error {
  readonly service: OutboundService;
  readonly kind: OutboundErrorKind;
  readonly retryable: boolean;
  readonly context: string;
  readonly cause?: unknown;

  constructor(args: OutboundErrorArgs) {
    super(args.message);
    this.name = this.constructor.name;
    this.service = args.service;
    this.kind = args.kind;
    this.retryable = args.retryable;
    this.context = args.context;
    this.cause = args.cause;
  }
}

export interface OutboundRateLimitErrorArgs {
  service: OutboundService;
  context: string;
  retryAfterMs: number | null;
  message?: string;
  cause?: unknown;
}

export class OutboundRateLimitError extends OutboundError {
  readonly retryAfterMs: number | null;

  constructor(args: OutboundRateLimitErrorArgs) {
    super({
      service: args.service,
      kind: OutboundErrorKind.RateLimit,
      retryable: true,
      context: args.context,
      message: args.message ?? "Rate limited by external service",
      cause: args.cause,
    });
    this.retryAfterMs = args.retryAfterMs;
  }
}

export interface OutboundAuthErrorArgs {
  service: OutboundService;
  context: string;
  status?: number;
  message?: string;
  cause?: unknown;
}

export class OutboundAuthError extends OutboundError {
  readonly status?: number;

  constructor(args: OutboundAuthErrorArgs) {
    super({
      service: args.service,
      kind: OutboundErrorKind.Auth,
      retryable: false,
      context: args.context,
      message: args.message ?? "Authentication failed",
      cause: args.cause,
    });
    this.status = args.status;
  }
}

export interface OutboundTransportErrorArgs {
  service: OutboundService;
  context: string;
  status?: number;
  message?: string;
  retryable?: boolean;
  cause?: unknown;
}

export class OutboundTransportError extends OutboundError {
  readonly status?: number;

  constructor(args: OutboundTransportErrorArgs) {
    const retryable = args.retryable ?? (args.status !== undefined && args.status >= 500);
    super({
      service: args.service,
      kind: OutboundErrorKind.Transport,
      retryable,
      context: args.context,
      message:
        args.message ??
        `Transport error${args.status !== undefined ? ` (HTTP ${args.status})` : ""}`,
      cause: args.cause,
    });
    this.status = args.status;
  }
}

export interface OutboundMappingErrorArgs {
  service: OutboundService;
  context: string;
  message?: string;
  cause?: unknown;
}

export class OutboundMappingError extends OutboundError {
  constructor(args: OutboundMappingErrorArgs) {
    super({
      service: args.service,
      kind: OutboundErrorKind.Mapping,
      retryable: false,
      context: args.context,
      message: args.message ?? "Mapping failed",
      cause: args.cause,
    });
  }
}

export interface OutboundCircuitOpenErrorArgs {
  service: OutboundService;
  context: string;
  retryAfterMs: number;
  message?: string;
}

export class OutboundCircuitOpenError extends OutboundError {
  readonly retryAfterMs: number;

  constructor(args: OutboundCircuitOpenErrorArgs) {
    super({
      service: args.service,
      kind: OutboundErrorKind.BreakerOpen,
      retryable: false,
      context: args.context,
      message: args.message ?? `Circuit breaker open — retry after ${args.retryAfterMs}ms`,
    });
    this.retryAfterMs = args.retryAfterMs;
  }
}

export function isTransientError(err: unknown): boolean {
  if (err instanceof OutboundError) return err.retryable;
  if (err instanceof Error && err.name === "AbortError") return true;
  if (err instanceof TypeError) return true;
  return false;
}

export function shouldTripBreaker(err: unknown): boolean {
  if (err instanceof OutboundRateLimitError) return false;
  if (err instanceof OutboundCircuitOpenError) return false;
  if (err instanceof OutboundError) return err.retryable;
  if (err instanceof Error && err.name === "AbortError") return true;
  if (err instanceof TypeError) return true;
  return false;
}
