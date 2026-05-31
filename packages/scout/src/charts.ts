import type { ChartApp } from "@hahaton/contracts";
import { type ChartFeed, fetchItunesChart } from "./sources/itunes-charts.js";

/**
 * A cross-continent default set of App Store markets for the Global Niche Radar.
 * Kept ~24 so a single Worker invocation stays under the subrequest budget.
 */
export const DEFAULT_RADAR_COUNTRIES = [
  "us",
  "gb",
  "ca",
  "au",
  "de",
  "fr",
  "es",
  "it",
  "nl",
  "se",
  "pl",
  "ua",
  "br",
  "mx",
  "jp",
  "kr",
  "in",
  "id",
  "th",
  "vn",
  "tr",
  "ae",
  "za",
  "ng",
];

export interface CollectChartsOpts {
  genreId?: number;
  feed?: ChartFeed;
  countries?: string[];
  limitPerCountry?: number;
}

/**
 * Fetch the chosen chart across many countries (resilient: a failing country is
 * dropped, never sinks the rest). Returns a flat ChartApp[] tagged with country
 * + rank — cross-country detection happens downstream.
 */
export async function collectCharts(opts: CollectChartsOpts = {}): Promise<ChartApp[]> {
  const countries = opts.countries ?? DEFAULT_RADAR_COUNTRIES;
  const settled = await Promise.allSettled(
    countries.map((country) =>
      fetchItunesChart(country, {
        genreId: opts.genreId,
        feed: opts.feed,
        limit: opts.limitPerCountry ?? 50,
      }),
    ),
  );
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
