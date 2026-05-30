import { OutboundError } from "@hahaton/outbound";

/**
 * Normalizes any thrown value into the shape the `error` AgentEvent carries.
 * When it's an `OutboundError` (e.g. from the LLM gateway), surface its `kind`
 * and `retryable` so the SSE/UI can react (retry banner, auth prompt, etc.).
 */
export function errorMeta(err: unknown): {
  message: string;
  kind?: string;
  retryable?: boolean;
} {
  if (err instanceof OutboundError) {
    return { message: err.message, kind: err.kind, retryable: err.retryable };
  }
  return { message: err instanceof Error ? err.message : String(err) };
}
