import type { Review } from "@hahaton/contracts";
import type { LlmProvider } from "@hahaton/llm";
import { describe, expect, it } from "vitest";
import { classifyReviews } from "./classify.js";

const review = (id: string, competitorId: string, body: string, rating?: number): Review => ({
  id,
  competitorId,
  source: "itunes",
  body,
  rating,
});

function mockLlm(content: string): LlmProvider {
  return {
    name: "mock",
    complete: async () => ({ content }),
    chat: async () => ({ content }),
  } as unknown as LlmProvider;
}

describe("classifyReviews", () => {
  it("parses signals, stamps competitorId/rating, drops invalid kinds + unknown reviews", async () => {
    const reviews = [
      review("r1", "ios-1", "paywall too early", 2),
      review("r2", "ios-1", "love voice", 5),
    ];
    const llm = mockLlm(
      JSON.stringify([
        {
          reviewId: "r1",
          kind: "pricing_issue",
          theme: "paywall before value",
          quote: "paywall too early",
        },
        { reviewId: "r2", kind: "praised_feature", theme: "voice practice" },
        { reviewId: "r2", kind: "not_a_kind", theme: "x" },
        { reviewId: "ghost", kind: "pain", theme: "y" },
      ]),
    );
    const signals = await classifyReviews(llm, reviews);
    expect(signals).toHaveLength(2);
    expect(signals[0]).toMatchObject({
      reviewId: "r1",
      competitorId: "ios-1",
      kind: "pricing_issue",
      rating: 2,
    });
    expect(signals[1]).toMatchObject({ reviewId: "r2", kind: "praised_feature", rating: 5 });
  });

  it("skips a malformed batch without throwing", async () => {
    const signals = await classifyReviews(mockLlm("not json at all"), [review("r1", "ios-1", "x")]);
    expect(signals).toEqual([]);
  });
});
