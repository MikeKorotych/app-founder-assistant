# Scout — mobile-app competitor finder + ranker (`@hahaton/scout`)

> **Status: implemented.** Given a mobile-app idea (pre-extracted keywords), Scout
> discovers competing apps across 4 sources, ranks them by how directly they compete,
> and persists the ranked list to D1. Runs as a **Cloudflare Workflow**.

## Shape (fan-out → fan-in → rank)

```
POST /scout {keywords[], categories?[], idea?, country?}
        │  spawns
        ▼
 CompetitorDiscoveryWorkflow            ← apps/api/src/scout/workflow.ts
   ├─ step fetch:itunes        ┐
   ├─ step fetch:googleplay    │ 4 isolated, retried (exp. backoff) steps, in parallel
   ├─ step fetch:producthunt   │ → RawCompetitor[]
   ├─ step fetch:alternativeto ┘
   ├─ dedupeById (merge same app across keywords)        ← fan-in
   ├─ step rank   → LLM (Haiku) scores each 0–100 + rationale, sorts desc
   └─ step ingest → upsert into D1 `competitors` (by id)
        ▼
GET /scout/:id → { status, competitors[] }  (best compatibility first)
```

## Sources (`packages/scout/src/sources/`)

| Source | Auth | How | Notes |
|---|---|---|---|
| **iTunes Search** | none | `GET itunes.apple.com/search?media=software&entity=software` | iOS apps; rich metadata. |
| **Google Play** | `SEARCH_API_KEY` | SerpApi `google_play` engine | `google-play-scraper` can't run on Workers → SERP API. Degrades to empty without a key. |
| **Product Hunt** | `PRODUCTHUNT_TOKEN` | API v2 GraphQL (popular posts, keyword-filtered client-side — v2 has no text search) | Degrades to empty without a token. |
| **AlternativeTo** | none | `HTMLRewriter` scrape of the search page | No public API; best-effort, brittle, degrades to empty on markup change. |

Each source maps its results to the unified **`RawCompetitor`** (`id` = `${source}-${externalId}`),
deduped within-source across keywords. Sources fail independently — a retried step that
ultimately errors just contributes nothing.

## Ranking (`rank.ts`)

One batched **Haiku** (`MODELS.haiku`) call via the `LlmProvider` seam (`@hahaton/llm`,
LiteLLM gateway). System prompt scores each candidate 0–100 for how *directly* it competes
with the idea (or keywords+categories when no `idea` given), each with a one-line rationale.
Output is parsed defensively (tolerates code fences / stray text; clamps 0–100; unscored
candidates default to 0 and sink, never dropped), then sorted descending.

## Persistence (`persist.ts` + `packages/db`)

New D1 table **`competitors`** (migration `packages/db/migrations/0001_living_chat.sql`):
upsert on `id` (chunked `db.batch` + `onConflictDoUpdate`) so overlapping keywords / re-runs
update rather than duplicate. `runId` = the workflow `instanceId`. `listCompetitors(db, runId)`
reads them back ordered by `compatibilityScore desc`.

## Files

```
packages/scout/src/
  types.ts                 ScoutParams / RawCompetitor / ScoredCompetitor / ScoutSummary
  sources/{itunes,googleplay,producthunt,alternativeto}.ts
  normalize.ts             dedupeById
  rank.ts                  rankCompetitors (Haiku batch)
  persist.ts               persistCompetitors / listCompetitors (D1)
  index.ts                 barrel + runScout (in-process runner for local/tests)
  scout.spec.ts            unit tests (dedupe + ranking parse/clamp/sort)
apps/api/src/
  scout/workflow.ts        CompetitorDiscoveryWorkflow (WorkflowEntrypoint)
  index.ts                 POST /scout, GET /scout/:id, exports the workflow class
  env.ts                   DISCOVERY_WORKFLOW + SEARCH_API_KEY + PRODUCTHUNT_TOKEN bindings
  wrangler.jsonc           workflows[] binding (top-level + prod + dev)
packages/db/src/schema/index.ts   competitors table
```

## Decisions (per the user)
- Build target: **Cloudflare Workflow + D1 now** (not a transport-agnostic deferral).
- Sources: **Gemini's set** (iTunes + Google Play SERP + Product Hunt + AlternativeTo).
- Input: **pre-extracted `{keywords, categories}`** (+ optional `idea` to sharpen ranking).
- Persistence: **D1 via Drizzle**.

## Credentials
- `SEARCH_API_KEY` — SerpApi (`serpapi.com` → Dashboard → API Key); `google_play` engine.
- `PRODUCTHUNT_TOKEN` — Product Hunt v2 developer token (`producthunt.com/v2/oauth/applications`
  → Add app → Create Token).
- Set both via `wrangler secret put`; locally in `apps/api/.dev.vars`.

## Verification (done)
- `pnpm typecheck` — 11/11 green (incl. scout + api). `pnpm --filter @hahaton/scout test` — 4/4.
- `wrangler deploy --dry-run` — Worker bundles; `DISCOVERY_WORKFLOW (CompetitorDiscoveryWorkflow)` binding recognized.
- `wrangler d1 migrations apply hahaton --local` — `competitors` table created.
- Manual: `wrangler dev` then
  `curl -X POST localhost:8787/scout -H 'content-type: application/json' -d '{"keywords":["habit tracker","fitness coach"],"idea":"social accountability habit tracker"}'`
  → `{id}`; poll `GET /scout/:id`. (Needs LLM gateway env + at least iTunes reachable; Play/PH need keys.)

## Coordination
A14 (source auth metadata for paid mobile-intel APIs, in `packages/integrations`) is **Codex's** —
no file overlap with this work (scout / db / api). Scout reads its source keys directly from
env today; it can adopt Codex's auth helpers later.

## Known limitations / follow-ups
- Product Hunt v2 has no text search → we keyword-filter popular posts (coarse recall).
- AlternativeTo scraping is brittle by nature (no API).
- Cross-store dedupe is by `id` only (same app on iOS+Android stays two rows) — a fuzzy
  title+developer merge is a possible follow-up.
- No SSE timeline yet; `/scout/:id` is poll-based. Wire into `competitorsStep` later.
