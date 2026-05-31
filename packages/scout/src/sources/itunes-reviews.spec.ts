import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchItunesReviews } from "./itunes-reviews.js";

afterEach(() => vi.restoreAllMocks());

const meta = { "im:name": { label: "Some App" } };
const review = (id: string, rating: string, body: string) => ({
  id: { label: id },
  "im:rating": { label: rating },
  title: { label: `t-${id}` },
  content: { label: body },
  author: { name: { label: "user" } },
});

function stubFetch(impl: () => unknown) {
  vi.stubGlobal("fetch", vi.fn(impl) as unknown as typeof fetch);
}

describe("fetchItunesReviews", () => {
  it("skips the metadata entry and maps reviews", async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => ({
        feed: { entry: [meta, review("1", "5", "great"), review("2", "1", "buggy")] },
      }),
    }));
    const out = await fetchItunesReviews("123", "ios-123", { maxPages: 1 });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      competitorId: "ios-123",
      source: "itunes",
      rating: 5,
      body: "great",
    });
    expect(out[1]).toMatchObject({ rating: 1, body: "buggy" });
  });

  it("does not throw on a failed page", async () => {
    stubFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    await expect(fetchItunesReviews("123", "ios-123")).resolves.toEqual([]);
  });
});
