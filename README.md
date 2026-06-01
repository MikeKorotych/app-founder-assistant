# hahaton-2026

AI CEO / Founder Strategist — an agentic **Idea → Business Plan** pipeline.

Structured as a **Turborepo + pnpm** monorepo: reusable packages shared across
apps, and standalone apps that deploy to **Cloudflare**.

## Live

| Surface | URL |
| --- | --- |
| **App (open this)** | https://founder-assistant-web.mikekorotych.workers.dev |
| Global Digest | https://founder-assistant-web.mikekorotych.workers.dev/digest |
| API (Hono Worker) | https://founder-assistant-api.mikekorotych.workers.dev |

Both deploy automatically from `main` via GitHub Actions (`.github/workflows/deploy.yml`).

## Layout

```
hahaton-2026/
├── apps/
│   ├── api/                  @hahaton/api             Hono Worker — agent pipeline API (Cloudflare Workers)
│   └── web/                  @hahaton/web             Next.js report UI (Cloudflare via OpenNext)
├── packages/
│   ├── contracts/            @hahaton/contracts       Frozen shared types — the single source of truth
│   ├── unit-economics/       @hahaton/unit-economics  Pure deterministic econ engine (reused by API + UI)
│   ├── agent/                @hahaton/agent           Orchestrator + pipeline steps
│   ├── llm/                  @hahaton/llm             LiteLLM gateway provider (the agent's LLM calls)
│   ├── outbound/             @hahaton/outbound        Outbound resilience core (retry, breaker, errors)
│   ├── db/                   @hahaton/db              Drizzle schema + D1 client + migrations
│   ├── store/                @hahaton/store           D1-backed run persistence (replay safety net)
│   └── integrations/         @hahaton/integrations    External API source/auth contracts + OpenAPI codegen
├── .github/workflows/        deploy.yml               CI (check/typecheck/test) + deploy api & web
├── biome.json                Lint + format (Biome)
├── turbo.json                Task graph (build/dev/typecheck/check/test + caching)
├── pnpm-workspace.yaml       Workspace globs + dependency catalog
└── tsconfig.base.json        Compiler options every workspace extends (bundler resolution)
```

**Dependency direction** (apps depend on packages; packages depend on `contracts`):

```
@hahaton/api ─┬─> @hahaton/agent ──> @hahaton/llm ──> @hahaton/outbound
              │                  └─> @hahaton/contracts
              ├─> @hahaton/store ──> @hahaton/db ──> @hahaton/contracts
              └─> @hahaton/unit-economics ─> @hahaton/contracts

@hahaton/web ─> @hahaton/contracts
```

## Stack
- Node **22**, TypeScript (ESM, `moduleResolution: bundler`)
- pnpm workspaces (catalog) + Turborepo
- **Hono** on **Cloudflare Workers** for the API; **Next.js** + **OpenNext** for the web surface
- **D1 + Drizzle** for persistence; **Biome** for lint/format
- LLM calls routed through a LiteLLM gateway (`@hahaton/llm`)

Library packages export **TS source** (`exports: ./src/index.ts`), so wrangler/esbuild
and Next bundle them directly — no per-package build step.

## Quick start

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # add your LLM gateway creds
pnpm --filter @hahaton/db generate                 # generate the D1 migration (once)
pnpm --filter @hahaton/api exec wrangler d1 migrations apply DB --local
pnpm --filter @hahaton/api dev                      # wrangler dev on http://localhost:8787
```

Test it:

```bash
curl http://localhost:8787/health
curl -X POST http://localhost:8787/pipeline -H 'content-type: application/json' -d '{"idea":"AI tutor for kids","region":"EU"}'
curl      http://localhost:8787/runs/<id>          # replay a persisted run
curl -N  "http://localhost:8787/agent/stream?idea=AI%20tutor"   # SSE stream
```

Web surface: `pnpm --filter @hahaton/web dev` (http://localhost:3000).

## Commands (run from the repo root)

| Command                   | What it does                                                  |
| ------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                | `turbo run dev` — all watchers in parallel                   |
| `pnpm build`              | `turbo run build` — Worker dry-run bundle + Next/OpenNext    |
| `pnpm typecheck`          | `turbo run typecheck` across every workspace                 |
| `pnpm check`              | Biome lint + format check (the CI gate)                      |
| `pnpm check:fix`          | Biome — apply lint + format fixes                            |
| `pnpm test`               | `turbo run test`                                             |
| `pnpm db:generate`        | generate a D1 migration from the Drizzle schema              |
| `pnpm generate:contracts` | regenerate external API types (`@hahaton/integrations`)      |

> Local toolchain note: **wrangler 4.x requires Node ≥ 22**. CI pins Node 22.

## Generating external API contracts

`@hahaton/integrations` declares every external API and its auth in
[`packages/integrations/src/sources.ts`](packages/integrations/src/sources.ts).
The codegen emits typed clients into `packages/integrations/src/generated/`
(git-ignored), exposed as `@hahaton/integrations/generated`.

## Adding a new workspace

- **A reusable package:** create `packages/<name>/` with a `package.json`
  (`"name": "@hahaton/<name>"`, `exports` → `./src/index.ts`), a `tsconfig.json`
  that `extends: "../../tsconfig.base.json"`, and `src/index.ts`. Depend on it
  with `"@hahaton/<name>": "workspace:*"`, then `pnpm install`.
- **A new app:** same, under `apps/<name>/` (Worker: add a `wrangler.jsonc`).

## Deploy to Cloudflare

CI (`.github/workflows/deploy.yml`) runs `check typecheck test` on every push/PR, then on
push to `main` deploys the Worker (`deploy-api`: D1 migrate with time-travel rollback →
`wrangler secret put` → `wrangler deploy`) and the web surface (`deploy-web`: OpenNext
build + deploy).

One-time setup (manual — outside this repo):

1. `pnpm --filter @hahaton/api exec wrangler d1 create hahaton-prod` and paste the
   `database_id` into `apps/api/wrangler.jsonc` (replaces `REPLACE_WITH_D1_DATABASE_ID`).
2. Set `LLM_GATEWAY_BASE_URL` in `apps/api/wrangler.jsonc` `vars`.
3. Add **GitHub repo secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
   `LLM_GATEWAY_API_KEY`, and `API_URL` (the deployed Worker URL, for the web build).
