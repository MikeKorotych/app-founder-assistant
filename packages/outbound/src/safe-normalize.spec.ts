import { OutboundAuthError, OutboundMappingError, OutboundService } from "./errors.js";
import { safeNormalize } from "./safe-normalize.js";

describe("safeNormalize", () => {
  it("returns the result when fn succeeds", () => {
    const result = safeNormalize(() => ({ id: "x" }), {
      service: OutboundService.Litellm,
      context: "normalizeCompletion",
    });
    expect(result).toEqual({ id: "x" });
  });

  it("wraps a thrown Error as OutboundMappingError with service + context", () => {
    expect(() =>
      safeNormalize(
        () => {
          throw new Error("missing id field");
        },
        { service: OutboundService.Litellm, context: "normalizeCompletion" },
      ),
    ).toThrow(OutboundMappingError);

    try {
      safeNormalize(
        () => {
          throw new Error("missing id field");
        },
        { service: OutboundService.Litellm, context: "normalizeCompletion" },
      );
    } catch (err) {
      expect(err).toBeInstanceOf(OutboundMappingError);
      const mapping = err as OutboundMappingError;
      expect(mapping.service).toBe("litellm");
      expect(mapping.context).toBe("normalizeCompletion");
      expect(mapping.message).toBe("missing id field");
    }
  });

  it("preserves the original error as cause for downstream debugging", () => {
    const original = new Error("boom");
    try {
      safeNormalize(
        () => {
          throw original;
        },
        { service: OutboundService.Litellm, context: "normalizeUsage" },
      );
    } catch (err) {
      expect((err as OutboundMappingError).cause).toBe(original);
    }
  });

  it("wraps non-Error throws as OutboundMappingError with default message", () => {
    try {
      safeNormalize(
        () => {
          throw "just a string";
        },
        { service: OutboundService.Litellm, context: "normalizeCompletion" },
      );
    } catch (err) {
      expect(err).toBeInstanceOf(OutboundMappingError);
      expect((err as OutboundMappingError).message).toBe("Mapping failed");
    }
  });

  it("passes OutboundError through unchanged (does not re-wrap)", () => {
    const original = new OutboundAuthError({
      service: OutboundService.Litellm,
      context: "x",
    });
    try {
      safeNormalize(
        () => {
          throw original;
        },
        { service: OutboundService.Litellm, context: "normalizeCompletion" },
      );
    } catch (err) {
      expect(err).toBe(original);
      expect(err).not.toBeInstanceOf(OutboundMappingError);
    }
  });
});
