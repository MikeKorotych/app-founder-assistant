# Appfigures (app market intelligence)

App-store analytics / market-intelligence API (App Store + Google Play). Base: `https://api.appfigures.com/v2`.

## Credentials

Real values live **only** in `apps/api/.dev.vars` (gitignored) and, in prod, as Worker secrets
(`wrangler secret put`). Never commit them. Variable names:

| Var | Purpose |
|-----|---------|
| `APPFIGURES_PAT` | Personal access token — used as `Authorization: Bearer <pat>`. Enough for server calls. |
| `APPFIGURES_CLIENT_KEY` | OAuth/HMAC client key (only for OAuth flows — not needed for PAT calls). |
| `APPFIGURES_SECRET_KEY` | OAuth/HMAC secret (same). |

Account login/password is for the website only and is **not** stored in the repo (the API uses the PAT).

```bash
curl https://api.appfigures.com/v2/ -H "Authorization: Bearer $APPFIGURES_PAT"
```

## ⚠️ Access tier — verified 2026-05-30 (read this before relying on it)

This account's PAT is valid (limit 1000 calls/day) but access is **limited**:

- `GET /v2/` → 200 (auth OK).
- `GET /v2/products/mine` → `{}` — **no app-store accounts connected**, so there is no owned-app data
  (no sales, no owned reviews, no owned ranks).
- `GET /v2/products/search/{term}` (a competitor app) → **403 "requires Partner API Access. Reason:
  some given products are not owned by your account"**.
- `GET /v2/reviews` → 400 "your account has no default products".

**Conclusion:** with the current token we can read **only owned apps**, and none are connected →
effectively no data today. Competitor / market data (search, others' reviews, ranks, download &
revenue estimates) needs **Partner API Access** (paid). To unlock value, either:
1. **Connect app-store accounts** in Appfigures (then owned-app sales/reviews/ranks become available), or
2. **Upgrade to Partner API Access** (then competitor/market endpoints below work).

Until then, do competitor/market research via the already-active sources (web_search, iTunes/Play
scrapers, Reddit, Bluesky) — see `docs/integrations-status.md`. Appfigures stays **deferred**.

## What Appfigures *can* provide (once access is unlocked)

| Endpoint | Data | Useful for (our validation categories) |
|----------|------|----------------------------------------|
| `GET /products/search/{term}` | Find apps by name across stores | Competitor discovery → **Solution × Differentiation** |
| `GET /products/{store}/{id}` | App metadata: name, dev, price, category, release | Competitor profile, pricing → **Business Model × UE** |
| `GET /reviews?products=...` | Reviews: stars, text, country, version, sentiment | Voice-of-customer / pain validation, CustDev → **Problem × Market** |
| `GET /ratings` | Rating histograms | Adoption/satisfaction proxy → **Problem × Market** |
| `GET /ranks` | Category & keyword rank history | Traction & channel signal → **GTM × Traction** |
| `GET /sales` (owned) | Downloads & revenue (owned apps) | Real unit-economics inputs → **Business Model × UE** |
| `GET /featured` | Featured placements | Distribution signal → **GTM × Traction** |
| estimates (Partner) | Download/revenue estimates for any app | Market sizing & competitor traction → **Problem × Market** |

## Notes for the integration (workstream A)

- Wire as a source in `packages/integrations` (handwritten module, like `reddit.ts`) **only after**
  Partner/owned access is real — otherwise every call 403s/400s.
- Suggested Worker bindings (add to `apps/api/src/env.ts` when wiring): `APPFIGURES_PAT?`,
  `APPFIGURES_CLIENT_KEY?`, `APPFIGURES_SECRET_KEY?`.
- Rate limit: 1000 calls/day on this account — cache aggressively.
- Reference: http://docs.appfigures.com/api
