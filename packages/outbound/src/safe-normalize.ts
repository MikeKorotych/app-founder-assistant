import { ErrorFallback, toErrorMessage } from "./error-message.js";
import { OutboundError, OutboundMappingError, type OutboundService } from "./errors.js";

export interface SafeNormalizeArgs {
  service: OutboundService;
  context: string;
}

export function safeNormalize<T>(fn: () => T, args: SafeNormalizeArgs): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof OutboundError) throw err;
    throw new OutboundMappingError({
      service: args.service,
      context: args.context,
      message: toErrorMessage(err, ErrorFallback.Mapping),
      cause: err,
    });
  }
}
