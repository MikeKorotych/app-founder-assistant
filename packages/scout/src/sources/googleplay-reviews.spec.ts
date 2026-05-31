import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGooglePlayReviews } from "./googleplay-reviews.js";

afterEach(() => vi.restoreAllMocks());

describe("fetchGooglePlayReviews", () => {
  it("returns [] without an api key", async () => {
    await expect(fetchGooglePlayReviews("com.x", "play-com.x", undefined)).resolves.toEqual([]);
  });

  it("maps SerpApi reviews defensively and skips empty bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          reviews: [
            {
              id: "r1",
              title: "ok",
              snippet: "love it",
              rating: 5,
              author: "a",
              iso_date: "2025-01-01",
            },
            { text: "crashes", rating: 1, name: "b" },
            { rating: 4 }, // no text → skipped
          ],
        }),
      })) as unknown as typeof fetch,
    );
    const out = await fetchGooglePlayReviews("com.x", "play-com.x", "KEY");
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      competitorId: "play-com.x",
      source: "googleplay",
      rating: 5,
      body: "love it",
      author: "a",
      at: "2025-01-01",
    });
    expect(out[1]).toMatchObject({ body: "crashes", author: "b", rating: 1 });
  });
});
