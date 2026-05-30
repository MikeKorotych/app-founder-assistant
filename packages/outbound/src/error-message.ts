export const ErrorFallback = {
  Unknown: "Unknown error",
  Mapping: "Mapping failed",
  Transport: "Transport error",
} as const;
export type ErrorFallback = (typeof ErrorFallback)[keyof typeof ErrorFallback];

export const toErrorMessage = (err: unknown, fallback?: string): string =>
  err instanceof Error ? err.message : (fallback ?? String(err));
