# hahaton-2026

AI CEO / Founder Strategist — an agentic **Idea → Business Plan** pipeline.

Structured as a **Turborepo + pnpm** monorepo: reusable packages shared across
apps, and standalone apps that run as services in parallel.

## Layout

```
hahaton-2026/
├── apps/
│   └── api/                  @hahaton/api             Express HTTP service (deployed to Cloudflare)
├── packages/
│   ├── contracts/            @hahaton/contracts       Frozen shared types — the single source of truth
│   ├── unit-economics/       @hahaton/unit-economics  Pure deterministic econ engine (reused by API + UI)
│   ├── agent/                @hahaton/agent           Orchestrator + pipeline steps
│   ├── store/                @hahaton/store           JSON-on-disk run persistence
│   └── integrations/         @hahaton/integrations    External API source/auth contracts + OpenAPI codegen
├── turbo.json                Task graph (build/dev/typecheck ordering + caching)
├── pnpm-workspace.yaml       Workspace globs (apps/*, packages/*)
└── tsconfig.base.json        Compiler options every workspace extends
```

**Dependency direction** (apps depend on packages; packages depend on `contracts`):

```
@hahaton/api ─┬─> @hahaton/agent ──────> @hahaton/contracts
              ├─> @hahaton/store ──────> @hahaton/contracts
              └─> @hahaton/unit-economics ─> @hahaton/contracts

@hahaton/integrations (standalone — consumed by data-fetching services)
```

## Stack
- Node 20, TypeScript (ESM, `NodeNext`)
- pnpm workspaces + Turborepo
- Express HTTP server, `@anthropic-ai/sdk` for the agent

## Quick start

```bash
pnpm install
cp .env.example apps/api/.env   # add your ANTHROPIC_API_KEY
pnpm dev                        # turbo runs every package's watch + the api server in parallel
```

Test it (api defaults to http://localhost:3000):

```bash
curl -X POST http://localhost:3000/agent    -H 'content-type: application/json' -d '{"prompt":"hello"}'
curl -X POST http://localhost:3000/pipeline  -H 'content-type: application/json' -d '{"idea":"AI tutor for kids","region":"EU"}'
curl      http://localhost:3000/runs/<id>    # replay a persisted run
```

## Commands (run from the repo root)

| Command                      | What it does                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| `pnpm dev`                   | `turbo run dev` — all package watchers + the api server, in parallel |
| `pnpm build`                 | `turbo run build` — builds the whole graph in dependency order      |
| `pnpm typecheck`             | `turbo run typecheck` across every workspace                        |
| `pnpm generate:contracts`    | regenerate external API types (see `@hahaton/integrations`)         |
| `pnpm clean`                 | clear build outputs + `node_modules`                                |

Scope any task to one workspace with a filter:

```bash
pnpm --filter @hahaton/api dev
pnpm --filter @hahaton/integrations generate:contracts -- googleplay
pnpm --filter @hahaton/agent... build      # the package and everything it depends on
```

## Generating external API contracts

`@hahaton/integrations` declares every external API and its auth in
[`packages/integrations/src/sources.ts`](packages/integrations/src/sources.ts).
The codegen fetches/reads each OpenAPI doc and emits typed clients into
`packages/integrations/src/generated/` (git-ignored), exposed as
`@hahaton/integrations/generated`. See
[`packages/integrations/specs/README.md`](packages/integrations/specs/README.md)
for which sources work out of the box vs. need a vendored spec file.

## Adding a new workspace

- **A reusable package:** create `packages/<name>/` with a `package.json`
  (`"name": "@hahaton/<name>"`, `exports` → `./dist`), a `tsconfig.json` that
  `extends: "../../tsconfig.base.json"`, and `src/index.ts`. Depend on it from
  an app with `"@hahaton/<name>": "workspace:*"`, then `pnpm install`.
- **A new service/app:** same, under `apps/<name>/`, with `dev`/`build`/`start`
  scripts. `turbo run dev` will run it alongside the others automatically.

## Deploy to Cloudflare (the `api` service)

Target platform is **Cloudflare** (Workers/Pages). The port is in progress — the
Express server is being adapted to the Workers runtime (filesystem `store` → KV/R2,
long pipeline → Workflows/Durable Object, secrets → Worker bindings). See the
migration notes in the plan.

1. Push to GitHub.
2. Configure `wrangler` for `@hahaton/api` and connect the repo to Cloudflare.
3. Provide `ANTHROPIC_API_KEY` as a Worker secret (`wrangler secret put ANTHROPIC_API_KEY`).
