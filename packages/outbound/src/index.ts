/**
 * @hahaton/outbound — resilience core for outbound calls.
 *
 * Two layers in the system share ONLY this error taxonomy: REST integrations
 * (which extend `OutboundHttpClient`) and the LiteLLM provider (which sits on
 * the openai SDK and maps its errors into `Outbound*Error`).
 */

export type {
  CircuitBreakerConfig,
  CircuitBreakerOptions,
  CircuitState,
} from "./circuit-breaker.js";
export {
  CIRCUIT_STATES,
  CircuitBreaker,
  DEFAULT_BREAKER,
} from "./circuit-breaker.js";
export { ErrorFallback, toErrorMessage } from "./error-message.js";
export type {
  OutboundAuthErrorArgs,
  OutboundCircuitOpenErrorArgs,
  OutboundErrorArgs,
  OutboundMappingErrorArgs,
  OutboundRateLimitErrorArgs,
  OutboundTransportErrorArgs,
} from "./errors.js";
export {
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
export type {
  ErrorMapper,
  OutboundHttpClientConfig,
  RequestOptions,
} from "./outbound-http.client.js";
export { OutboundHttpClient } from "./outbound-http.client.js";
export type { RetryConfig, WithRetryOptions } from "./retry.js";
export { computeDelay, DEFAULT_RETRY, withRetry } from "./retry.js";
export type { SafeNormalizeArgs } from "./safe-normalize.js";
export { safeNormalize } from "./safe-normalize.js";
