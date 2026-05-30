import { describe, expect, it, vi } from "vitest";
import type { RawCompetitor } from "./types.js";

// Mock the source/rank/persist modules so we can drive one source to fail and
// assert the run survives with a warning. Hoisted per-file — kept separate from
// scout.spec.ts (which exercises the real producthunt module).
const app = (id: string): RawCompetitor => ({
  id,
  name: id,
  source: "itunes",
  platforms: ["ios"],
  rating: 0,
  reviewCount: 0,
});

vi.mock("./sources/itunes.js", () => ({ fetchItunes: async () => [app("ios-1")] }));
vi.mock("./sources/googleplay.js", () => ({ fetchGooglePlay: async () => [app("play-1")] }));
vi.mock("./sources/producthunt.js", () => ({ fetchProductHunt: async () => [app("ph-1")] }));
vi.mock("./sources/alternativeto.js", () => ({
  fetchAlternativeTo: async () => {
    throw new Error('AlternativeTo 403 for "x"');
  },
}));
vi.mock("./rank.js", () => ({
  rankCompetitors: async (_llm: unknown, _p: unknown, candidates: RawCompetitor[]) =>
    candidates.map((c) => ({ ...c, compatibilityScore: 0, rationale: "" })),
}));
const { persist } = vi.hoisted(() => ({ persist: vi.fn(async () => {}) }));
vi.mock("./persist.js", () => ({ persistCompetitors: persist, listCompetitors: vi.fn() }));

import { runScout } from "./index.js";

describe("runScout — source isolation", () => {
  const deps = { llm: {}, db: {} } as never;

  it("keeps surviving sources and surfaces a warning for the failed one", async () => {
    const summary = await runScout(deps, "run-1", { keywords: ["x"] });
    // itunes + googleplay + producthunt survived; alternativeto failed.
    expect(summary.discovered).toBe(3);
    expect(summary.ranked).toBe(3);
    expect(summary.warnings).toEqual(['alternativeto: AlternativeTo 403 for "x"']);
    expect(persist).toHaveBeenCalledOnce();
  });
});
