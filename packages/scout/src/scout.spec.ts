import type {
  LlmChatRequest,
  LlmChatResponse,
  LlmProvider,
  LlmRequest,
  LlmResponse,
} from "@hahaton/llm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dedupeById } from "./normalize.js";
import { rankCompetitors } from "./rank.js";
import { fetchProductHunt } from "./sources/producthunt.js";
import type { RawCompetitor } from "./types.js";

const app = (over: Partial<RawCompetitor>): RawCompetitor => ({
  id: "ios-1",
  name: "App",
  source: "itunes",
  platforms: ["ios"],
  rating: 0,
  reviewCount: 0,
  ...over,
});

/** Stub provider that echoes a canned chat response. */
function stubLlm(content: string | null): LlmProvider {
  return {
    name: "stub",
    complete: async (_r: LlmRequest): Promise<LlmResponse> => ({ content: "", model: "stub" }),
    chat: async (_r: LlmChatRequest): Promise<LlmChatResponse> => ({
      content,
      model: "stub",
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cachedTokens: 0,
        cacheWriteTokens: 0,
        costUsd: null,
      },
    }),
  };
}

describe("dedupeById", () => {
  it("merges duplicates, keeping the richer description + max rating/reviews", () => {
    const out = dedupeById([
      app({ id: "ios-1", description: "short", rating: 3, reviewCount: 10 }),
      app({ id: "ios-1", description: "a much longer description", rating: 4.5, reviewCount: 5 }),
      app({ id: "ios-2", name: "Other" }),
    ]);
    expect(out).toHaveLength(2);
    const first = out.find((c) => c.id === "ios-1");
    expect(first?.description).toBe("a much longer description");
    expect(first?.rating).toBe(4.5);
    expect(first?.reviewCount).toBe(10);
  });
});

describe("rankCompetitors", () => {
  const candidates = [
    app({ id: "ios-1", name: "Habitify" }),
    app({ id: "play-2", name: "Streaks", source: "googleplay", platforms: ["android"] }),
  ];

  it("attaches scores and sorts by compatibility desc (tolerates fenced JSON)", async () => {
    const llm = stubLlm(
      '```json\n{"scores":[{"id":"ios-1","score":42,"rationale":"adjacent"},{"id":"play-2","score":91,"rationale":"head-on"}]}\n```',
    );
    const ranked = await rankCompetitors(llm, { keywords: ["habit tracker"] }, candidates);
    expect(ranked.map((c) => c.id)).toEqual(["play-2", "ios-1"]);
    expect(ranked[0].compatibilityScore).toBe(91);
    expect(ranked[0].rationale).toBe("head-on");
  });

  it("falls back to 0/unscored when the model output is unparseable", async () => {
    const ranked = await rankCompetitors(
      stubLlm("sorry, no json"),
      { keywords: ["x"] },
      candidates,
    );
    expect(ranked).toHaveLength(2);
    expect(ranked.every((c) => c.compatibilityScore === 0)).toBe(true);
    expect(ranked[0].rationale).toMatch(/not scored/i);
  });

  it("clamps out-of-range scores to 0–100", async () => {
    const llm = stubLlm(
      '{"scores":[{"id":"ios-1","score":150,"rationale":"x"},{"id":"play-2","score":-5,"rationale":"y"}]}',
    );
    const ranked = await rankCompetitors(llm, { keywords: ["x"] }, candidates);
    expect(ranked.find((c) => c.id === "ios-1")?.compatibilityScore).toBe(100);
    expect(ranked.find((c) => c.id === "play-2")?.compatibilityScore).toBe(0);
  });
});

describe("fetchProductHunt", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Captures request bodies and replays one canned PH posts payload per call. */
  function stubFetch(nodesByCall: PhStubNode[][]) {
    const bodies: { slug: string; first: number }[] = [];
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const parsed = JSON.parse(init.body) as { variables: { slug: string; first: number } };
        bodies.push(parsed.variables);
        const nodes = nodesByCall[call++] ?? [];
        return {
          ok: true,
          json: async () => ({ data: { posts: { edges: nodes.map((node) => ({ node })) } } }),
        } as Response;
      }),
    );
    return bodies;
  }

  type PhStubNode = {
    id: string;
    name: string;
    tagline?: string;
    votesCount?: number;
    featuredAt?: string;
    createdAt?: string;
  };

  it("returns empty without a token (no request made)", async () => {
    const bodies = stubFetch([]);
    const out = await fetchProductHunt({ keywords: ["habit tracker"] }, undefined);
    expect(out).toEqual([]);
    expect(bodies).toHaveLength(0);
  });

  it("queries one VOTES-ordered topic per category slug (aliased + slugified)", async () => {
    const bodies = stubFetch([
      [{ id: "1", name: "Notion", tagline: "docs", votesCount: 99 }],
      [{ id: "2", name: "Strava", tagline: "runs", votesCount: 50 }],
    ]);
    const out = await fetchProductHunt(
      { keywords: ["x"], categories: ["Productivity", "Health & Fitness"] },
      "tok",
    );
    expect(bodies.map((b) => b.slug)).toEqual(["productivity", "health-and-fitness"]);
    expect(out.map((c) => c.id)).toEqual(["ph-1", "ph-2"]);
    expect(out[0]).toMatchObject({ source: "producthunt", reviewCount: 99, platforms: ["web"] });
  });

  it("maps launchedAt from featuredAt, falling back to createdAt", async () => {
    stubFetch([
      [
        { id: "1", name: "Featured", votesCount: 9, featuredAt: "2026-05-01T00:00:00Z" },
        { id: "2", name: "Created-only", votesCount: 8, createdAt: "2026-04-01T00:00:00Z" },
        { id: "3", name: "Neither", votesCount: 7 },
      ],
    ]);
    const out = await fetchProductHunt({ keywords: ["x"], categories: ["productivity"] }, "tok");
    expect(out.map((c) => c.launchedAt)).toEqual([
      "2026-05-01T00:00:00Z",
      "2026-04-01T00:00:00Z",
      undefined,
    ]);
  });

  it("falls back to slugified keywords when no categories are given", async () => {
    const bodies = stubFetch([[]]);
    await fetchProductHunt({ keywords: ["Developer Tools"] }, "tok");
    expect(bodies.map((b) => b.slug)).toEqual(["developer-tools"]);
  });

  it("throws on a non-ok response so the workflow step can retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401 }) as Response),
    );
    await expect(
      fetchProductHunt({ keywords: ["x"], categories: ["productivity"] }, "tok"),
    ).rejects.toThrow(/Product Hunt 401/);
  });
});
