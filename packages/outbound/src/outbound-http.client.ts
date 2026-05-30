import { CircuitBreaker, type CircuitBreakerConfig, DEFAULT_BREAKER } from "./circuit-breaker.js";
import { ErrorFallback, toErrorMessage } from "./error-message.js";
import {
  OutboundAuthError,
  OutboundError,
  OutboundRateLimitError,
  type OutboundService,
  OutboundTransportError,
} from "./errors.js";
import { DEFAULT_RETRY, type RetryConfig, withRetry } from "./retry.js";

export type ErrorMapper = (response: Response, bodyText: string) => OutboundError | null;

export interface OutboundHttpClientConfig {
  baseUrl: string;
  service: OutboundService;
  authHeaderBuilder?: () => string | null;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  retry?: RetryConfig;
  breaker?: CircuitBreakerConfig | null;
  errorMapper?: ErrorMapper;
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
  context?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const ERROR_BODY_PREVIEW_LIMIT = 500;

export class OutboundHttpClient {
  protected readonly baseUrl: string;
  protected readonly service: OutboundService;
  private readonly authHeaderBuilder?: () => string | null;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly retryConfig: RetryConfig;
  private readonly breaker: CircuitBreaker | null;
  private readonly errorMapper?: ErrorMapper;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OutboundHttpClientConfig) {
    this.baseUrl = stripTrailingSlash(config.baseUrl);
    this.service = config.service;
    this.authHeaderBuilder = config.authHeaderBuilder;
    this.defaultHeaders = config.defaultHeaders ?? {
      "Content-Type": "application/json",
    };
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryConfig = config.retry ?? DEFAULT_RETRY;
    this.breaker =
      config.breaker === null
        ? null
        : new CircuitBreaker(config.breaker ?? DEFAULT_BREAKER, config.service);
    this.errorMapper = config.errorMapper;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  protected get<T>(path: string, options: Omit<RequestOptions, "body"> = {}): Promise<T> {
    return this.request<T>("GET", path, options);
  }

  protected post<T>(
    path: string,
    body: unknown,
    options: Omit<RequestOptions, "body"> = {},
  ): Promise<T> {
    return this.request<T>("POST", path, { ...options, body });
  }

  protected patch<T>(
    path: string,
    body: unknown,
    options: Omit<RequestOptions, "body"> = {},
  ): Promise<T> {
    return this.request<T>("PATCH", path, { ...options, body });
  }

  protected delete<T>(path: string, options: Omit<RequestOptions, "body"> = {}): Promise<T> {
    return this.request<T>("DELETE", path, options);
  }

  protected async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const context = options.context ?? `${method} ${path}`;
    const url = this.buildUrl(path, options.query);
    const runOnce = (): Promise<T> => this.executeOnce<T>(method, url, options, context);
    const breakerWrapped = this.breaker
      ? (): Promise<T> => this.breaker!.execute(runOnce)
      : runOnce;
    return withRetry<T>(breakerWrapped, { config: this.retryConfig });
  }

  protected buildUrl(path: string, query?: Record<string, string>): string {
    const base = path.startsWith("http")
      ? path
      : `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const url = new URL(base);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }
    return url.toString();
  }

  private async executeOnce<T>(
    method: string,
    url: string,
    options: RequestOptions,
    context: string,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...(options.headers ?? {}),
    };
    const auth = this.authHeaderBuilder?.();
    if (auth) headers["Authorization"] = auth;

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
      return await this.handleResponse<T>(response, context);
    } catch (err) {
      if (err instanceof OutboundError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new OutboundTransportError({
          service: this.service,
          context,
          message: `Request timed out after ${this.timeoutMs}ms`,
          retryable: true,
          cause: err,
        });
      }
      throw new OutboundTransportError({
        service: this.service,
        context,
        message: toErrorMessage(err, ErrorFallback.Transport),
        retryable: true,
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleResponse<T>(response: Response, context: string): Promise<T> {
    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    }

    const bodyText = await response.text().catch(() => "");
    const mapped = this.errorMapper?.(response, bodyText);
    if (mapped) throw mapped;

    if (response.status === 401 || response.status === 403) {
      throw new OutboundAuthError({
        service: this.service,
        context,
        status: response.status,
        message: `HTTP ${response.status}: ${truncate(bodyText)}`,
      });
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const retryAfterMs = parseRetryAfter(retryAfter);
      throw new OutboundRateLimitError({
        service: this.service,
        context,
        retryAfterMs,
        message: `HTTP 429: ${truncate(bodyText)}`,
      });
    }

    throw new OutboundTransportError({
      service: this.service,
      context,
      status: response.status,
      message: `HTTP ${response.status}: ${truncate(bodyText)}`,
    });
  }
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function truncate(s: string): string {
  return s.length <= ERROR_BODY_PREVIEW_LIMIT ? s : `${s.slice(0, ERROR_BODY_PREVIEW_LIMIT)}…`;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}
