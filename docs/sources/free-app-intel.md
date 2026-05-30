# Free alternatives to Appfigures (app & competitor intel)

Appfigures competitor/market data is gated behind paid **Partner API Access**
(see [appfigures.md](appfigures.md)). This is the **free** stack that covers most of what we
actually need for validation: competitor discovery, app metadata, ratings, reviews, and traction
signals — no paid tier.

> Verified live on **2026-05-30** (the ✅ ones). What you **can't** get for free anywhere reliable:
> download/revenue **estimates** (the paid moat of Sensor Tower / data.ai / Appfigures). We proxy
> traction with **rating counts + chart rank** instead.

## Tier 1 — free, no auth, verified ✅

| Source | Endpoint | Data | Verified |
|--------|----------|------|----------|
| **Apple iTunes Search** | `GET https://itunes.apple.com/search?term={q}&entity=software&country={cc}` | name, developer, price, genre, **averageUserRating**, **userRatingCount**, screenshots, version, bundleId, release dates, size | ✅ (Calm: 4.77★, 1.96M ratings) |
| **Apple iTunes Lookup** | `GET https://itunes.apple.com/lookup?id={trackId}` (or `?bundleId=`) | same fields, by app id | ✅ |
| **Apple RSS reviews** | `GET https://itunes.apple.com/{cc}/rss/customerreviews/id={id}/sortBy=mostRecent/json` | reviews: rating, title, body, author, version (≈50/page, up to ~10 pages) | ✅ (50 entries) |
| **Apple RSS charts** | `GET -L https://rss.applemarketingtools.com/api/v2/{cc}/apps/top-free/{n}/apps.json` (also `top-paid`, `top-grossing`) | top-chart apps per country (traction/demand signal) | ✅ (301 → follow redirect with `-L`) |
| **Hacker News (Algolia)** | `GET https://hn.algolia.com/api/v1/search?query={q}&tags=story` | launches, Show HN, points, comments — startup discourse & traction | ✅ (28k hits for "notion") |

## Tier 1b — free, unofficial scraper (no key)

| Source | How | Data | Caveat |
|--------|-----|------|--------|
| **Google Play** | `google-play-scraper` (npm, v10.x) | app details, **reviews**, **similar apps**, search, **ratings histogram**, top charts, permissions, data-safety | Unofficial (scrapes Play HTML) — ToS gray area, can break; cache + be gentle. (Codex already added a no-auth iTunes/Play scraper to the registry.) |

## Tier 2 — free with a free key / OAuth (already in our registry)

| Source | Auth | Value |
|--------|------|-------|
| **Reddit** | free OAuth (script app) | pain points, feature requests, sentiment on competitors → CustDev |
| **Product Hunt** | free dev token (GraphQL) | launches, upvotes, makers, positioning → competitor discovery + traction |
| **Bluesky** | free app password | public chatter / demand signal |
| **Kickstarter** | none (undocumented `?format=json`) | demand signals, backer language |

## Free market / funding / traffic proxies (non-app-store)

| Source | Auth | Value |
|--------|------|-------|
| **Wikipedia / Wikidata REST** | none | company facts, founding, funding rounds, employee count |
| **Tranco list** | none (download) | domain popularity rank — free traffic proxy |
| **Cloudflare Radar** | free API | domain/traffic ranking signals |
| **web_search** (Anthropic, native) | `ANTHROPIC_API_KEY` | the core grounding tool — news, funding, market reports with citations |

## Mapping to our validation categories

| Category | Free sources |
|----------|--------------|
| **Problem × Market** (demand, who pays) | iTunes charts + rating counts, Play top charts, Reddit/HN demand, web_search market reports, Wikidata |
| **Solution × Differentiation** (competitors) | iTunes Search + Lookup, google-play-scraper (search/similar), Product Hunt, HN |
| **Business Model × Unit Economics** (pricing) | iTunes/Play `price` + IAP tiers, competitor pricing pages via web_search/Firecrawl |
| **GTM × First Traction** (channels, traction) | iTunes/Play chart rank, rating-count growth, Product Hunt upvotes, HN points |

## Recommended free stack (what to actually wire)

1. **Apple iTunes Search/Lookup + RSS reviews + RSS charts** — the richest free, no-auth, no-ToS-risk source for iOS competitor metadata, ratings, reviews, and chart traction. **Top priority.**
2. **google-play-scraper** — Android parity (details, reviews, similar, histogram). Unofficial but free.
3. **Reddit + Hacker News + Product Hunt** — already in the registry; cover voice-of-customer, demand, and launch traction.
4. **web_search + Wikidata** — funding/market facts and anything the above miss.

This set replaces Appfigures for our purposes. The only real gap vs paid tools is **download/revenue
estimates** — we approximate with rating counts and chart positions, which is honest to state in the report.

## Notes for workstream A

- iTunes + Play scraper are no-auth → add as registry sources with `spec.kind: "unavailable"` (REST/scraper, no OpenAPI), like the existing scraper entry.
- Rate-limit politely and cache; the iTunes Search API is undocumented-but-stable and tolerant, the RSS feeds are CDN-cached, Play scraping is the fragile one.
- No secrets needed for Tier 1 — nothing to add to `.dev.vars`.
