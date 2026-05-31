import { describe, expect, it } from "vitest";
import { summarizeRankHistory } from "./index";

describe("summarizeRankHistory", () => {
  it("returns null with no rows", () => {
    expect(summarizeRankHistory("ios-1", [])).toBeNull();
  });

  it("marks a single-day app as 'new' (not enough history yet)", () => {
    const h = summarizeRankHistory("ios-1", [{ capturedOn: "2026-06-01", rank: 12 }]);
    expect(h?.trend).toBe("new");
    expect(h?.daysTracked).toBe(1);
    expect(h?.rankDelta).toBe(0);
    expect(h?.peakRank).toBe(12);
  });

  it("uses the best (lowest) rank per day across markets", () => {
    const h = summarizeRankHistory("ios-1", [
      { capturedOn: "2026-06-01", rank: 20 },
      { capturedOn: "2026-06-01", rank: 8 }, // best of the day
      { capturedOn: "2026-06-03", rank: 5 },
    ]);
    expect(h?.firstBestRank).toBe(8);
    expect(h?.currentBestRank).toBe(5);
    expect(h?.peakRank).toBe(5);
    expect(h?.daysTracked).toBe(2);
  });

  it("flags a climb up the chart as 'rising' with positive delta", () => {
    const h = summarizeRankHistory("ios-1", [
      { capturedOn: "2026-06-01", rank: 30 },
      { capturedOn: "2026-06-02", rank: 18 },
    ]);
    expect(h?.trend).toBe("rising");
    expect(h?.rankDelta).toBe(12); // 30 → 18 = +12 positions
  });

  it("flags a drop as 'falling' with negative delta", () => {
    const h = summarizeRankHistory("ios-1", [
      { capturedOn: "2026-06-01", rank: 5 },
      { capturedOn: "2026-06-04", rank: 22 },
    ]);
    expect(h?.trend).toBe("falling");
    expect(h?.rankDelta).toBe(-17);
  });

  it("flags small movement as 'flat' (within the noise threshold)", () => {
    const h = summarizeRankHistory("ios-1", [
      { capturedOn: "2026-06-01", rank: 10 },
      { capturedOn: "2026-06-02", rank: 12 },
    ]);
    expect(h?.trend).toBe("flat");
  });

  it("orders days lexically so first/last are chronological", () => {
    const h = summarizeRankHistory("ios-1", [
      { capturedOn: "2026-06-10", rank: 4 },
      { capturedOn: "2026-06-02", rank: 40 },
      { capturedOn: "2026-06-05", rank: 15 },
    ]);
    expect(h?.firstDay).toBe("2026-06-02");
    expect(h?.lastDay).toBe("2026-06-10");
    expect(h?.rankDelta).toBe(36); // 40 → 4
  });
});
