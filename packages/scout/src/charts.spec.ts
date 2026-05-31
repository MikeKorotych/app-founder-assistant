import type { ChartApp } from "@hahaton/contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("./sources/itunes-charts.js", () => ({
  fetchItunesChart: vi.fn(async (country: string) => {
    if (country === "xx") throw new Error("boom");
    return [{ appId: `${country}-1`, name: "App", rank: 1, country }] as ChartApp[];
  }),
}));

import { collectCharts } from "./charts.js";

describe("collectCharts", () => {
  it("flattens charts across countries and survives a failing country", async () => {
    const out = await collectCharts({ countries: ["us", "xx", "br"] });
    // "xx" throws → dropped; us + br survive.
    expect(out.map((a) => a.country).sort()).toEqual(["br", "us"]);
  });
});
