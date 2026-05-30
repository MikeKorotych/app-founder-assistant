# Plan: Scout sub-agent — grounded source fan-out (`@hahaton/scout`)

> **What it is.** A self-contained research sub-agent that turns one business idea into
> a set of **per-source research reports** grounded in real external data. It is the
> "go pull real signals from the web" stage that feeds the main pipeline's `market` and
> `competitors` steps (and can run standalone via an API endpoint).
>
> **Status:** plan only — no runtime code yet. This file is the spec; build under the
> roadmap sub-tasks `A13…A17` (workstream A, see `plan.html` → Roadmap).

---

## 1. The shape (matches the requested workflow)

```
            idea prompt
                │
        ┌───────▼─────────┐
        │  ENTRYPOINT     │  runScout(input) — single public fn
        └───────┬─────────┘
                │
        ┌───────▼──────────────────────────────────┐
        │  PHASE 1 · PLAN          (1 LLM call)     │  idea + SOURCES registry
        │  "find the API contract for each source   │  → SourceRequest[]
        │   and build a concrete HTTP request"      │  (url, headers, query, body)
        └───────┬──────────────────────────────────┘
                │  fan-out (one task per source)
     ┌──────────┼───────────┬───────────┐
     ▼          ▼           ▼           ▼
 ┌───────┐  ┌───────┐   ┌───────┐   ┌───────┐   PHASE 2 · QUERY (parallel)
 │source │  │source │   │source │   │source │   each: do the HTTP call with the
 │  A    │  │  B    │   │  C    │   │  D    │   provided request → raw output
 └───┬───┘  └───┬───┘   └───┬───┘   └───┬───┘   (Firecrawl fallback if no API)
     └──────────┴─────┬─────┴───────────┘
                      ▼
        ┌──────────────────────────────┐         PHASE 3 · AGGREGATE (barrier)
        │  await ALL source outputs     │         one task that waits for every
        │  → normalize + dedupe         │         source result, then continues
        └───────┬──────────────────────┘
                │  fan-out again (one per source)
     ┌──────────┼───────────┬───────────┐
     ▼          ▼           ▼           ▼
 ┌───────┐  ┌───────┐   ┌───────┐   ┌───────┐   PHASE 4 · REPORT (parallel)
 │report │  │report │   │report │   │report │   each: LLM turns one source's raw
 │  A    │  │  B    │   │  C    │   │  D    │   data → a structured SourceReport
 └───┬───┘  └───┬───┘   └───┬───┘   └───┬───┘
     └──────────┴─────┬─────┴───────────┘
                      ▼
                ScoutReport         ← FINISH LINE
        { requests, results, reports[], citations }
```

This is a textbook **fan-out → fan-in → fan-out** pipeline and maps 1:1 to the requested
design: a planner, parallel per-source query workers, one aggregator that waits on all of
them, then a per-source report generator.

---

## 2. Key reconciliation: the "API contracts" already exist

The request says "the scout looks on the web to find API contracts for the sites (they're
in Notion)." **That Notion table is already encoded in this repo** as the frozen
`@hahaton/integrations` source registry (`packages/integrations/src/sources.ts`,
18 sources with `auth`, `requiresAuth`, `canUseWithoutAuth`, `howToGetAuth`, `apiAccess`,
`researchValue`, and an OpenAPI `spec`).

So Phase 1 does **not** re-discover contracts from scratch. It:

1. **Reads `SOURCES`** as ground truth for which APIs exist and how they authenticate.
2. **Picks the relevant subset** for the idea (LLM ranks by `researchValue` + idea fit).
3. **Builds a concrete request** per chosen source from a small per-source
   **request template** (Section 5) — filling in the idea's keywords/query terms.
4. Uses `web_search` / Firecrawl **only as a fallback** to discover an exact endpoint or
   to scrape when a source has no usable JSON API.

This keeps the contract frozen and the demo grounded, instead of letting the agent
hallucinate endpoints live. Honest, reproducible, and fast.

---

## 3. Demo-viable sources (no-auth first)

From live API research (May 2026). The MVP runs the **no-auth** set so the demo works
with zero credential setup; auth'd sources are gated behind `input.demoSafe === false`
and the registry's `canUseWithoutAuth` flag.

| Source | Auth for demo | Endpoint (built in Phase 1) | Keyword search? |
|---|---|---|---|
| **Hacker News** (Algolia) | none ✅ | `GET https://hn.algolia.com/api/v1/search?query=<kw>&tags=story&hitsPerPage=20` | ✅ |
| **iTunes Search** | none ✅ | `GET https://itunes.apple.com/search?term=<kw>&media=software&country=US&limit=25` | ✅ |
| **Reddit** (public) | none ✅ (UA header) | `GET https://www.reddit.com/search.json?q=<kw>&sort=top&t=year&limit=25` | ✅ |
| **Firecrawl search** | API key (cheap) | `POST https://api.firecrawl.dev/v2/search` `{query, limit, scrapeOptions}` | ✅ (web + scrape) |
| Reddit (OAuth), Product Hunt, G2, Capterra, Crunchbase, Trustpilot, Similarweb, App Store Connect, Google Play, Appfigures, Apptopia, data.ai, AppTweak, AppBrain, BigIdeasDB, Indiegogo, Kickstarter | requires creds | from registry + per-source template | mixed |

**Honest caveats from research (encode as `unavailable`/`fallback` in templates):**
- **AlternativeTo** — no public API; use Firecrawl scrape fallback or drop.
- **Indiegogo** — public API is fetch-by-ID only, **no keyword search** → Firecrawl fallback.
- **Product Hunt / Reddit-OAuth / Kickstarter** — OAuth; skip in demo-safe mode.
- **Reddit public `.json`** — must send a descriptive `User-Agent` or it throttles.

The 4 no-auth sources (HN + iTunes + Reddit + Firecrawl) are enough for a believable live run.

---

## 4. Package layout

New package `packages/scout` → `@hahaton/scout` (depends on `@hahaton/contracts` +
`@hahaton/integrations`; LLM via `@anthropic-ai/sdk`, or `LlmProvider` once the
llm-gateway plan lands — see `specs/llm-gateway-plan.md`).

```
packages/scout/
├── package.json              "@hahaton/scout", exports → ./dist, deps: contracts, integrations
├── tsconfig.json             extends ../../tsconfig.base.json
├── PLAN.md                   this file
└── src/
    ├── index.ts              barrel + runScout
    ├── types.ts              scout contracts (Section 6) — proposed addition to @hahaton/contracts
    ├── scout.ts              orchestrator: the 5 phases, event emission
    ├── plan-sources.ts       PHASE 1 — LLM picks sources + builds SourceRequest[]
    ├── request-templates.ts  per-source concrete request builders (Section 5)
    ├── fetch-source.ts       PHASE 2 — execute one SourceRequest (auth inject + Firecrawl fallback)
    ├── firecrawl.ts          thin Firecrawl /search + /scrape client (fallback)
    ├── aggregate.ts          PHASE 3 — fan-in: collect + dedupe + normalize
    └── report-source.ts      PHASE 4 — LLM: one source's raw data → SourceReport
```

---

## 5. Request templates (the "generate HTTP request info" core)

A `request-templates.ts` keyed by `ApiSource.id`. Each template takes resolved
keywords + the registry entry and returns the `http` descriptor. The LLM in Phase 1
**chooses sources and keywords**; templates **build the exact request** (deterministic,
no hallucinated URLs). Grounded shapes from research:

```ts
// keywords: string[] derived from the idea (Phase 1). enc = encodeURIComponent.
export const TEMPLATES: Record<string, (kw: string[], src: ApiSource) => SourceRequest> = {
  // No-auth, demo-safe -------------------------------------------------------
  hackernews: (kw) => ({
    sourceId: "hackernews", label: "Hacker News",
    rationale: "Founder/builder discussion + show-hn launches around the idea.",
    http: { method: "GET",
      url: `https://hn.algolia.com/api/v1/search?query=${enc(kw[0])}&tags=story&hitsPerPage=20` },
    fallback: "none",
  }),
  itunessearch: (kw) => ({
    sourceId: "itunessearch", label: "iTunes Search",
    rationale: "Existing iOS apps in the space → competitors, prices, ratings.",
    http: { method: "GET",
      url: `https://itunes.apple.com/search?term=${enc(kw.join(" "))}&media=software&country=US&limit=25` },
    fallback: "none",
  }),
  reddit: (kw) => ({
    sourceId: "reddit", label: "Reddit (public)",
    rationale: "Real user pain points, complaints, demand signals.",
    http: { method: "GET",
      url: `https://www.reddit.com/search.json?q=${enc(kw.join(" "))}&sort=top&t=year&limit=25`,
      headers: { "User-Agent": "hahaton-2026-scout/0.1 (research)" } },
    fallback: "firecrawl-search",
  }),
  // Fallback / paid (built but gated by canUseWithoutAuth) --------------------
  firecrawl: (kw) => ({
    sourceId: "firecrawl", label: "Firecrawl search",
    rationale: "Web-wide discovery + scraped content in one call (fallback + breadth).",
    http: { method: "POST", url: "https://api.firecrawl.dev/v2/search",
      headers: { Authorization: "Bearer ${FIRECRAWL_API_KEY}" },  // resolved at fetch time
      body: { query: kw.join(" "), limit: 8, scrapeOptions: { formats: ["markdown"], onlyMainContent: true } } },
    fallback: "none",
  }),
  // …auth'd sources reuse @hahaton/integrations auth.ts for header injection.
};
```

Auth injection for credentialed sources reuses the `Auth` discriminated union from
`@hahaton/integrations` (`apiKey` → header+prefix, `oauth2` → bearer, `jwt`,
`serviceAccount`, `supabaseAnon`). The `${ENV}` placeholders are resolved in
`fetch-source.ts`, never in the planner output (keeps secrets out of logs/persisted runs).

---

## 6. Contracts (proposed — freeze at team sync before consuming downstream)

Scout-local types live in `src/types.ts` first to avoid editing the frozen
`@hahaton/contracts`. Promote them into `contracts` once the shape is agreed. Reuses
`Citation` and `Fact` from `@hahaton/contracts`.

```ts
import type { Citation, Fact } from "@hahaton/contracts";

export interface ScoutInput {
  idea: string;            // raw idea, or brief.problem/valueProp from step 1
  region?: string;
  keywords?: string[];     // optional pre-extracted search terms
  demoSafe?: boolean;      // default true → only sources with canUseWithoutAuth
}

/** PHASE 1 output — one per chosen source. */
export interface SourceRequest {
  sourceId: string;        // === ApiSource.id
  label: string;
  rationale: string;
  http: {
    method: "GET" | "POST";
    url: string;                          // GET: query already in the URL
    headers?: Record<string, string>;     // ${ENV} placeholders, resolved at fetch
    body?: unknown;
  };
  fallback: "firecrawl-search" | "firecrawl-scrape" | "none";
}

/** PHASE 2 output — one per source. */
export interface SourceResult {
  sourceId: string;
  ok: boolean;
  via: "api" | "firecrawl" | "skipped";
  status?: number;
  data?: unknown;          // raw JSON or scraped markdown
  error?: { kind: string; message: string; retryable: boolean };
  fetchedAt: string;
  citations: Citation[];   // URLs touched (deduped into ScoutReport.citations)
}

export interface ScoutSignal {
  kind: "competitor" | "painPoint" | "demand" | "pricing" | "review" | "trend";
  text: string;
  evidence?: string;       // short verbatim quote
  citationId?: string;
  metric?: Fact;           // grounded number or estimated:true (same honesty rule)
}

/** PHASE 4 output — one per source. */
export interface SourceReport {
  sourceId: string;
  label: string;
  summary: string;
  signals: ScoutSignal[];
  citations: Citation[];
}

export interface ScoutReport {
  input: ScoutInput;
  requests: SourceRequest[];
  results: SourceResult[];
  reports: SourceReport[];
  citations: Citation[];   // all sources, deduped by URL
  createdAt: string;
}
```

**Streaming events** (scout-local; mirror the main pipeline's SSE style so the UI can
render a live "scouting" timeline). Keep local until merged into `AgentEvent`:

```ts
export type ScoutEvent =
  | { type: "scout_started"; at: string }
  | { type: "scout_source_planned"; sourceId: string; label: string; at: string }
  | { type: "scout_source_started"; sourceId: string; at: string }
  | { type: "scout_source_fetched"; sourceId: string; ok: boolean; via: string; at: string }
  | { type: "scout_aggregated"; sources: number; at: string }
  | { type: "scout_source_report"; sourceId: string; signals: number; at: string }
  | { type: "scout_completed"; at: string }
  | { type: "scout_error"; sourceId?: string; message: string; at: string };
```

---

## 7. Orchestration mechanism (fan-out / fan-in)

**MVP — in-process, `Promise.allSettled`.** Fits the current Express stack and is the
simplest thing that gives true parallelism + a clean barrier. One source failing never
sinks the run (`allSettled` → degrade to a `SourceResult` with `ok:false`).

```ts
export async function runScout(input: ScoutInput, emit: (e: ScoutEvent) => void = () => {}): Promise<ScoutReport> {
  emit({ type: "scout_started", at: nowIso() });

  // PHASE 1 — plan
  const requests = await planSources(input, client, emit);     // 1 LLM call

  // PHASE 2 — fan-out: query every source in parallel
  const settled = await Promise.allSettled(
    requests.map((r) => fetchSource(r, emit)),
  );
  const results = settled.map(toSourceResult);                 // never throws

  // PHASE 3 — fan-in barrier: aggregate + dedupe citations
  const aggregated = aggregate(results);
  emit({ type: "scout_aggregated", sources: results.length, at: nowIso() });

  // PHASE 4 — fan-out again: one report per source, in parallel
  const reports = (await Promise.allSettled(
    aggregated.results.filter((r) => r.ok).map((r) => reportSource(r, input, client, emit)),
  )).flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));

  emit({ type: "scout_completed", at: nowIso() });
  return { input, requests, results, reports, citations: aggregated.citations, createdAt: nowIso() };
}
```

**Production mapping (Cloudflare).** The deploy target is Cloudflare Workers, where a long
multi-fetch run should live in a **Workflow / Durable Object**, not one Worker invoke
(matches PLAN.md risk #3). The phases above map directly to Workflow steps: Phase 1 = one
step, Phase 2 = parallel `step.do()` per source, Phase 3 = the implicit join, Phase 4 =
parallel `step.do()` per report. Keep `runScout` transport-agnostic so the same function
body runs in-process locally and as Workflow steps in prod. (Trigger.dev — MCP is
connected — is a viable alternative orchestrator but adds infra; not needed for MVP.)

**Resilience.** Reuse the outbound core from `specs/llm-gateway-plan.md`
(`OutboundHttpClient`: timeout + retry + breaker) for Phase-2 fetches once it lands; until
then, plain `fetch` with an `AbortController` per-source timeout (~8s) and the `allSettled`
degrade path. Per-source token/time budgets in Phase 4.

---

## 8. Integration with the main pipeline

Two consumption modes, both off one `runScout`:

1. **Grounding provider for steps 2–3.** `competitorsStep` / `marketStep` call `runScout`
   (or read a pre-run `ScoutReport`) and feed `reports[].signals` + `citations` into their
   LLM context — turning today's stubbed `web_search` into real, multi-source grounding.
   Citations flow straight into `run.citations` (same `Citation` shape).
2. **Standalone endpoint.** `apps/api` adds `POST /scout` (and SSE `GET /scout/stream`)
   that runs `runScout` and streams `ScoutEvent`s — lets the UI show a dedicated
   "scouting sources" timeline before the business-plan steps.

The `Citation` reuse means scout's sources appear in the existing **Sources appendix** and
inline footnotes with zero extra UI work.

---

## 9. Build order (roadmap sub-tasks A13–A17)

- **A13 — Scaffold + contracts.** Package, `tsconfig`, `package.json`, `src/types.ts`,
  `src/index.ts`. `pnpm typecheck` green. Wire deps (`contracts`, `integrations`).
- **A14 — Phase 1 planner + templates.** `plan-sources.ts` + `request-templates.ts` for the
  4 no-auth sources. Unit-test: idea → expected `SourceRequest[]` (deterministic URLs).
- **A15 — Phase 2 fetch + Firecrawl fallback.** `fetch-source.ts`, `firecrawl.ts`, auth
  injection from the registry, per-source timeout, `allSettled` degrade. Live smoke test
  against HN + iTunes + Reddit (no creds).
- **A16 — Phase 3 + 4.** `aggregate.ts` (dedupe citations) + `report-source.ts` (LLM →
  `SourceReport`, honesty rule: every metric grounded or `estimated:true`). Emit events.
- **A17 — Wire-in.** `POST /scout` + SSE in `apps/api`; feed `competitorsStep`/`marketStep`;
  one golden `ScoutReport` persisted for offline replay.

---

## 10. Verification

1. **Planner determinism:** known idea → `SourceRequest[]` with exact, valid URLs for the
   no-auth set; demo-safe mode excludes credentialed sources.
2. **Live fan-out:** `runScout` against the demo idea hits HN + iTunes + Reddit, returns
   ≥3 `ok` results, one slow/failing source degrades (not the whole run).
3. **Firecrawl fallback:** a source with `fallback:"firecrawl-search"` and no API recovers
   content via Firecrawl when the primary call fails.
4. **Aggregation barrier:** Phase 4 starts only after all Phase-2 tasks settle; citations
   deduped by URL.
5. **Honesty:** every `ScoutSignal.metric` carries a `citationId` or `estimated:true`;
   no fabricated URLs (URLs only ever come from real responses).
6. **Replay:** a persisted `ScoutReport` re-renders the scouting timeline with no network.

---

## Open questions

1. **LLM client.** Use `@anthropic-ai/sdk` now, or wait for the `LlmProvider` shim from
   `specs/llm-gateway-plan.md`? (Lean: SDK now, swap later — same one-line change as the
   main pipeline.)
2. **Firecrawl key.** Free tier is 1,000 credits/mo, 5 `/search`/min — fine for demo. Add
   `FIRECRAWL_API_KEY` to `.env.example`? Without it, scout still runs on the 3 no-auth APIs.
3. **Keyword extraction.** Fold into the Phase-1 planner call, or reuse step-1 `brief`?
   (Lean: if a `brief` exists, derive keywords from it; else a small Haiku call.)
4. **Promote scout types into `@hahaton/contracts`** — needs a team-sync (frozen contract).
