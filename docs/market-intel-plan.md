# Market Intelligence suite — implementation plan

Post-hackathon track that turns the existing **Scout** (competitor discovery) into
real founder value: mine competitor reviews and global charts into decision-grade
insight. Roadmap group **M** in `plan.html`.

Guiding principle (same as the rest of the project): **grounded, not fabricated.**
Every quantitative value is either real (from a store listing) or clearly flagged
as an estimate. Outputs are **decision maps ("what to test first"), not verdicts.**
What needs paid market-intel APIs (true install/revenue figures, growth time-series)
is honestly deferred, never faked.

## Shared pipeline

```
Scout competitors (existing)
   → fetch reviews        (M1 · scout)
   → classify signals     (M1 · scout)
   → ┌ cluster + synthesize Opportunity Report   (M2 · agent → UI)
     └ per-competitor profiles                   (M3 · agent → UI)
   → /opportunity endpoint stitches it together  (M4 · api + web)

Global Niche Radar (separate data pipeline)
   → per-country top charts (iTunes country RSS)  (M5 · scout)
   → cross-country localized-winner detection     (M5 · agent → UI)
   → recurring digest (Cloudflare Cron + D1)       (M6 · api, ties to P3/P4)
```

## Status (2026-05-30)

| ID | Feature | Layer state | Status |
|----|---------|-------------|--------|
| M1 | Scout review data-layer (fetch + classify) | Codex building (`packages/scout`) | in-progress |
| M2 | Opportunity Radar | contract + agent + UI done, typecheck-green | review (pending wiring) |
| M3 | Competitive Landscape | contract + agent + UI done, typecheck-green | review (pending wiring) |
| M4 | `/opportunity` integration + mount | not started (waits on M1) | todo |
| M5 | Global Niche Radar (cross-country) | not started | todo |
| M6 | Recurring global digest | not started (ties to P3/P4) | todo |

---

## M1 — Scout review data-layer  *(packages/scout · Codex)*

**Goal:** fetch real user reviews for discovered competitors and classify each into signals.

**Data sources (honest):**
- App Store — **iTunes customer-reviews RSS JSON** (free, no key): `…/rss/customerreviews/page={p}/id={trackId}/sortby=mostrecent/json`, up to ~500 reviews. First feed entry is app metadata — skip it.
- Google Play — **SerpApi `google_play_product`** (key = `GOOGLE_SEARCH_API_KEY`); fewer reviews/call, field names vary → defensive mapping.
- Product Hunt / AlternativeTo — weak review coverage; skip for now.

**Deliverables:** `sources/itunes-reviews.ts`, `sources/googleplay-reviews.ts`, `reviews.ts` (`collectReviews` — top-N by reviewCount, derive appId from `competitor.id`, `Promise.allSettled`, cap), `classify.ts` (`classifyReviews` — batch ~20/LLM call, structured JSON, multilingual-aware, resilient). Tests for each.

**Cost/latency controls:** top-5 competitors, ≤40 reviews each, ≤150 total; batch classification; cache by competitor id (D1, later).

**Contract:** `Review`, `ReviewSignalKind`, `ReviewSignal` (already frozen in `@hahaton/contracts`).

---

## M2 — Opportunity Radar  *(agent + web · done, pending wiring)*

**Goal:** decision map from the mined signals — what to test first.

**Pipeline:** `clusterSignals(signals)` (deterministic group by kind+theme) → `buildOpportunityReport(llm, …)` (one LLM call → narrative judgement calls, Ukrainian via `withOutputLanguage`).

**Output (`OpportunityReport`):** topPains, loved, oneTwoStarReasons, saturation, opportunityGap, firstIcp, differentiation, **sevenDayTest**, **killCriterion**, reviewsAnalyzed, per-source counts.

**Files:** `packages/agent/src/steps/opportunity.ts`; `apps/web/app/_components/opportunity-radar.tsx`.

**Verification:** run on a real idea; confirm clusters reflect quotes; report stays tentative when sample is small.

---

## M3 — Competitive Landscape  *(agent + web · done, pending wiring)*

**Goal:** at-a-glance per-competitor picture — strengths/weaknesses, hook, inspire/avoid.

**Pipeline:** `buildCompetitorProfiles(llm, {idea, competitors, signals})` — groups each competitor's signals, profiles top-N in parallel (resilient per competitor).

**Output (`CompetitorProfile[]`):** reviewCount/rating (real), launchedAt (PH only), estimatedInstalls (est), positiveTheme, negativeTheme, strengths, weaknesses, hook, inspiration, avoid.

**Honest gaps:** install counts are estimates (label in UI); **growth-over-time is deferred** to paid APIs — no fake curves.

**Files:** `packages/agent/src/steps/competitive-landscape.ts`; `apps/web/app/_components/competitive-landscape.tsx`.

---

## M4 — Integration  *(api + web · todo, waits on M1)*

**Goal:** wire the data-layer to the synthesis + UI.

**API — `POST /opportunity`** (`apps/api/src/index.ts`): body `{ idea, scoutId | competitors }` →
`collectReviews` → `classifyReviews` → `Promise.all([buildOpportunityReport, buildCompetitorProfiles])`
→ return `{ report: OpportunityReport, profiles: CompetitorProfile[] }`.

**Web:** mount `<OpportunityRadar>` + `<CompetitiveLandscape>` in `ScoutRun` after the competitor list (toggle or auto after scout completes). Reuse the install-estimate helper.

**Verification:** real run → both blocks render with grounded content; typecheck + biome + scout tests green; push one coherent commit.

---

## M5 — Global Niche Radar  *(scout + agent + web · todo, separate pipeline)*

**Goal:** surface apps that took off in **one country/region** the founder isn't watching (geo-arbitrage).

**Data sources (honest):**
- **iTunes country top-charts RSS** (free): `…/{country}/rss/topnewfreeapplications/limit={n}/genre={id}/json` (also topfree/topgrossing). Fan out across ~20–40 countries for the idea's category.
- `topnewfree` = recently launched + popular → proxy for "rising".

**Detection:** cross-reference an app's presence/rank across country charts → high in country A but **absent in the home market** = a localized winner. Computed on free data.

**Honest gap:** true growth velocity (chart-position time-series) needs paid APIs — show "new + high in chart" as the rising proxy, defer velocity.

**Output (proposed `GlobalRadarEntry[]`):** app name, country/continent, chart + rank, url, "absent in {home}", one-line why-it-works; optional LLM "what to port".

**Files (proposed):** `packages/scout/src/sources/itunes-charts.ts` + `charts.ts`; `packages/agent/src/steps/global-radar.ts`; `apps/web/app/_components/global-niche-radar.tsx`; `POST /global-radar`.

---

## M6 — Recurring global digest  *(api · todo, ties to P3/P4)*

**Goal:** regular world digest of newly-risen players by continent/country.

**Mechanism:** **Cloudflare Cron Trigger** → run M5 on a schedule → store in D1 → surface digest (UI first; email/Slack later, per P2/P4). Overlaps the existing **P3/P4** post-MVP plan — build as one track.

---

## Sequencing

1. **Finish M1 → M4 first** (close the loop: Codex lands data-layer → wire `/opportunity` → both blocks live in a real run → push). Don't start M5 until M2/M3 are shipped and visible.
2. **Then M5** as a focused sprint (new country-charts data-layer).
3. **Then M6** (Cron digest), merged with the P3/P4 post-MVP plan.
