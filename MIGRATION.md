# Take this project into YOUR ownership

The project currently lives in a teammate's GitHub repo and runs on a teammate's
Cloudflare account ("phasekit"). To put it in your portfolio and grow it as a
product, you need: **your GitHub repo**, **your Cloudflare account** (Workers +
D1), **your LLM provider**, and **your API keys**. Nothing here is hard — it's
mostly swapping ids/keys. Below is exactly what's bound to whom, and the steps.

## What's currently tied to the teammate's accounts

| Thing | Current value | Where |
|------|----------------|-------|
| GitHub repo | `zlydenko/hahaton-2026` | git remote `origin` |
| Cloudflare account | `account_id: dbb2d590…` ("phasekit") | `apps/api/wrangler.jsonc` |
| Worker domains | `hahaton-api.phasekit.workers.dev`, `hahaton-web.phasekit.workers.dev` | `apps/api/wrangler.jsonc`, `apps/web/wrangler.jsonc`, `apps/web/app/_lib/api.ts` |
| D1 database | `name: hahaton`, `id: 2bf49a4c…` | `apps/api/wrangler.jsonc` |
| LLM gateway | shared LiteLLM proxy (`LLM_GATEWAY_BASE_URL` / `_API_KEY`) | CI secrets + `apps/api/.dev.vars` |
| SerpApi (Google Play) | `GOOGLE_SEARCH_API_KEY` | CI secret + `.dev.vars` |
| Product Hunt | `PRODUCTHUNT_TOKEN` | CI secret + `.dev.vars` |
| CI secrets | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `LLM_GATEWAY_*`, `GOOGLE_SEARCH_API_KEY`, `PRODUCTHUNT_TOKEN`, `API_URL` | GitHub Actions (teammate's repo) |

## Accounts / keys you'll need

1. **GitHub** — you have it (MikeKorotych).
2. **Cloudflare** (free plan is enough to start) — for Workers + D1 + Workflows + Cron.
3. **LLM provider** — the one real architecture decision. See below.
4. **SerpApi** — free tier (100 searches/mo) for Google Play data; optional (iTunes works without it).
5. **Product Hunt API token** — free; optional (Scout degrades without it).

## The one decision: LLM provider

`packages/llm` talks to a LiteLLM proxy **via the OpenAI SDK** (`baseURL` + key).
That means any OpenAI-compatible endpoint works by just changing two env vars +
the model names in `packages/llm/src/catalog.ts`. Options:

- **OpenRouter (recommended)** — OpenAI-compatible, your account, pay-as-you-go,
  one key for Claude + GPT + others. Set `LLM_GATEWAY_BASE_URL=https://openrouter.ai/api/v1`,
  `LLM_GATEWAY_API_KEY=<your key>`, map `MODELS` to OpenRouter model ids
  (e.g. `anthropic/claude-3.5-sonnet`). **Smallest change** (no proxy to run).
- **Direct Anthropic** — swap `LiteLlmProvider` to the Anthropic SDK + your
  `ANTHROPIC_API_KEY`. Cleanest if you only want Claude; a bit more code.
- **Your own LiteLLM proxy** — keeps the architecture, but you host the proxy.

Recommendation for "make it mine fast": **OpenRouter** — env-only change.

## Migration steps

### 1. Your GitHub repo
```bash
# new repo under your account (keeps full history)
gh repo create MikeKorotych/founder-strategist --private --source=. --remote=mine --push
# or: create empty repo on github, then:
git remote add mine https://github.com/MikeKorotych/<repo>.git && git push mine main
```
Update `README.md` (it still says hahaton). Drop teammate-specific bits from
`CLAUDE.md` (the 3-agent claim-commit ritual is hackathon-only).

### 2. Your Cloudflare — D1 + Workers
```bash
wrangler login                                   # your CF account
wrangler d1 create founder-strategist            # → prints database_id
```
In `apps/api/wrangler.jsonc`: replace `account_id`, `database_id`/`database_name`,
and rename the workers (`hahaton-api` → your name). Remove the stale `env.prod`/
`env.dev` blocks or align them. Apply migrations:
```bash
pnpm --filter @hahaton/api exec wrangler d1 migrations apply DB --remote
```

### 3. Fix hardcoded domains
After your first deploy you get `*.<your-subdomain>.workers.dev`. Update:
- `apps/web/wrangler.jsonc` → `API_URL`
- `apps/api/wrangler.jsonc` → `SURFACE_BASE_URL`
- `apps/web/app/_lib/api.ts` → the `API_BASE` default
(or set them all via `NEXT_PUBLIC_API_URL` at build + Worker vars).

### 4. Keys → your secrets
Local: put real values in `apps/api/.dev.vars` (gitignored). Prod: set GitHub
Actions secrets in YOUR repo — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`LLM_GATEWAY_BASE_URL`, `LLM_GATEWAY_API_KEY`, `GOOGLE_SEARCH_API_KEY`,
`PRODUCTHUNT_TOKEN`, `API_URL`. (The deploy workflow `.github/workflows/deploy.yml`
already wires these via `wrangler secret put`.)

### 5. Verify
`pnpm typecheck && pnpm test` → push → watch the deploy → hit `/health`,
`/digest/run`, run one idea end-to-end. Re-enable the biome step in CI once the
pre-existing lint errors are cleaned (it was dropped during the hackathon).

## Storage note
D1 (SQLite) is the right fit for Cloudflare Workers and already holds runs,
search-expansions, competitors, digests — no need to change the DB engine. Just
make the D1 instance yours (step 2).

## After it's yours — growth ideas (product direction)
- More data sources: Sensor Tower / data.ai / Appfigures (paid) for real
  installs/revenue/growth-over-time (currently estimated); Reddit/forums for pain.
- Better pipeline models: route reasoning-heavy steps (synthesis, sizing) to a
  stronger model now that it's your budget.
- Deeper analysis: sources appendix + citations, home-market picker for Global
  Radar, PDF export of the report.
