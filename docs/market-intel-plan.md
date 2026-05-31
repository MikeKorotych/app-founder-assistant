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

## Status (2026-05-31)

| ID | Feature | Layer state | Status |
|----|---------|-------------|--------|
| M1 | Scout review data-layer (fetch + classify) | `packages/scout`: iTunes RSS + SerpApi review fetch, batch classifier, tests | done |
| M2 | Opportunity Radar | contract + agent + UI, fed by `/opportunity` | done |
| M3 | Competitive Landscape | contract + agent + UI, fed by `/opportunity` | done |
| M4 | `/opportunity` integration + mount | API endpoint + `ScoutRun` mount in the real run | done |
| M5 | Global Niche Radar (cross-country) | country charts data-layer + localized-winner UI | review (pending live deploy verification) |
| M6 | Recurring global digest | Cloudflare Cron + D1 digest storage + `/digest` UI | review (pending live deploy verification) |

---

## M1 — Scout review data-layer  *(packages/scout · done)*

**Goal:** fetch real user reviews for discovered competitors and classify each into signals.

**Data sources (honest):**
- App Store — **iTunes customer-reviews RSS JSON** (free, no key): `…/rss/customerreviews/page={p}/id={trackId}/sortby=mostrecent/json`, up to ~500 reviews. First feed entry is app metadata — skip it.
- Google Play — **SerpApi `google_play_product`** (key = `GOOGLE_SEARCH_API_KEY`); fewer reviews/call, field names vary → defensive mapping.
- Product Hunt / AlternativeTo — weak review coverage; skip for now.

**Shipped deliverables:** `sources/itunes-reviews.ts`, `sources/googleplay-reviews.ts`, `reviews.ts` (`collectReviews` — top-N by reviewCount, derive appId from `competitor.id`, `Promise.allSettled`, cap), `classify.ts` (`classifyReviews` — batch ~20/LLM call, structured JSON, multilingual-aware, resilient). Tests cover the data-layer and classifier flow.

**Cost/latency controls:** top-5 competitors, ≤40 reviews each, ≤150 total; batch classification; cache by competitor id (D1, later).

**Contract:** `Review`, `ReviewSignalKind`, `ReviewSignal` (already frozen in `@hahaton/contracts`).

---

## M2 — Opportunity Radar  *(agent + web · done)*

**Goal:** decision map from the mined signals — what to test first.

**Pipeline:** `clusterSignals(signals)` (deterministic group by kind+theme) → `buildOpportunityReport(llm, …)` (one LLM call → narrative judgement calls, Ukrainian via `withOutputLanguage`).

**Output (`OpportunityReport`):** topPains, loved, oneTwoStarReasons, saturation, opportunityGap, firstIcp, differentiation, **sevenDayTest**, **killCriterion**, reviewsAnalyzed, per-source counts.

**Files:** `packages/agent/src/steps/opportunity.ts`; `apps/web/app/_components/opportunity-radar.tsx`.

**Next verification:** run several real ideas; confirm clusters reflect quotes; report stays tentative when sample is small; tune prompts where the 7-day MVP or kill criterion is too generic.

---

## M3 — Competitive Landscape  *(agent + web · done)*

**Goal:** at-a-glance per-competitor picture — strengths/weaknesses, hook, inspire/avoid.

**Pipeline:** `buildCompetitorProfiles(llm, {idea, competitors, signals})` — groups each competitor's signals, profiles top-N in parallel (resilient per competitor).

**Output (`CompetitorProfile[]`):** reviewCount/rating (real), launchedAt (PH only), estimatedInstalls (est), positiveTheme, negativeTheme, strengths, weaknesses, hook, inspiration, avoid.

**Honest gaps:** install counts are estimates (label in UI); **growth-over-time is deferred** to paid APIs — no fake curves.

**Files:** `packages/agent/src/steps/competitive-landscape.ts`; `apps/web/app/_components/competitive-landscape.tsx`.

---

## M4 — Integration  *(api + web · done)*

**Goal:** wire the data-layer to the synthesis + UI.

**API — `POST /opportunity`** (`apps/api/src/index.ts`): body `{ idea, scoutId | competitors }` →
`collectReviews` → `classifyReviews` → `Promise.all([buildOpportunityReport, buildCompetitorProfiles])`
→ return `{ report: OpportunityReport, profiles: CompetitorProfile[] }`.

**Web:** `<OpportunityRadar>` + `<CompetitiveLandscape>` are mounted in `ScoutRun` after the competitor list and reuse the existing live-run visual language.

**Verification:** real run → both blocks render with grounded content; typecheck + scout tests were green in the implementation commit. Remaining work is product-quality verification, not initial wiring.

---

## M5 — Global Niche Radar  *(scout + agent + web · review, separate pipeline)*

**Goal:** surface apps that took off in **one country/region** the founder isn't watching (geo-arbitrage).

**Data sources (honest):**
- **iTunes country top-charts RSS** (free): uses a valid country RSS feed such as `newfreeapplications`; fan out across countries for the idea's category.
- `newfreeapplications` = recently visible free apps → proxy for "rising" on free data.

**Detection:** cross-reference an app's presence/rank across country charts → high in country A but **absent in the home market** = a localized winner. Computed on free data.

**Honest gap:** true growth velocity (chart-position time-series) needs paid APIs — show "new + high in chart" as the rising proxy, defer velocity.

**Output (proposed `GlobalRadarEntry[]`):** app name, country/continent, chart + rank, url, "absent in {home}", one-line why-it-works; optional LLM "what to port".

**Shipped files:** `packages/scout/src/sources/itunes-charts.ts` + `charts.ts`; `packages/agent/src/steps/global-radar.ts`; `apps/web/app/_components/global-niche-radar.tsx`; `POST /global-radar`.

**Next verification:** live deploy check with real country/category combinations; confirm charts are not empty, labels are understandable, and "localized winner" reasoning is useful rather than decorative.

---

## M6 — Recurring global digest  *(api · review, ties to P3/P4)*

**Goal:** regular world digest of newly-risen players by continent/country.

**Mechanism:** **Cloudflare Cron Trigger** → run M5 on a schedule → store in D1 → surface digest in `/digest` (UI first; email/Slack later, per P2/P4). Overlaps the existing **P3/P4** post-MVP plan — build as one track.

**Next verification:** confirm cron bindings, D1 migrations, production data freshness, and the digest page on the deployed environment.

---

## Sequencing

1. **Now:** verify M1–M4 quality in real founder-like runs: review relevance, quote quality, useful opportunity gaps, non-generic 7-day MVP, and a clear kill criterion.
2. **Then:** live-deploy verification for M5/M6: country chart coverage, D1 persistence, cron freshness, `/digest` UX.
3. **Next product layer:** package the output (export/one-pager/golden scenario) and then add Slack alerts + recurring insight loops from the verified digest pipeline.
