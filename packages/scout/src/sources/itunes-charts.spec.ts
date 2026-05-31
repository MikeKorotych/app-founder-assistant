import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchItunesChart } from "./itunes-charts.js";

afterEach(() => vi.restoreAllMocks());

const entry = (id: string, name: string) => ({
  "im:name": { label: name },
  "im:artist": { label: `dev-${id}` },
  id: { label: `https://apps.apple.com/app/id${id}`, attributes: { "im:id": id } },
  link: { attributes: { href: `https://apps.apple.com/app/id${id}` } },
});

function stubFetch(impl: () => unknown) {
  vi.stubGlobal("fetch", vi.fn(impl) as unknown as typeof fetch);
}

describe("fetchItunesChart", () => {
  it("maps chart entries to ranked ChartApps tagged with country", async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => ({ feed: { entry: [entry("1", "Alpha"), entry("2", "Beta")] } }),
    }));
    const out = await fetchItunesChart("br", { genreId: 6007 });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ appId: "1", name: "Alpha", rank: 1, country: "br" });
    expect(out[1]).toMatchObject({ appId: "2", rank: 2, country: "br" });
  });

  it("returns [] on a failed fetch", async () => {
    stubFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    await expect(fetchItunesChart("us")).resolves.toEqual([]);
  });
});
