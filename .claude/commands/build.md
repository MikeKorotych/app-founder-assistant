---
description: Verify + edit build infra (wrangler.jsonc, CI workflow) for Cloudflare Workers. Auto-routes on "is CI green / build broken / verify build locally".
---

## Pre-flight rules (see ../../docs/stack.md)

- **No comments** — see [Comments policy](../../docs/stack.md#comments-policy). No `//`, `/* */`, JSDoc; only tooling pragmas.
- **No default exports** — see [No default exports](../../docs/stack.md#no-default-exports). ESM only.
- **Deterministic names** — see [Deterministic naming](../../docs/stack.md#deterministic-naming). kebab-case files, CONSTANT_CASE scalars.
- **No magic numbers** — see [Magic numbers](../../docs/stack.md#magic-numbers).
- **Self-check before done** — see [Self-check](../../docs/stack.md#self-check-before-declaring-a-task-done). Run `pnpm check` + `pnpm typecheck`.

> in: $ARGUMENTS = mode [verify|local|fix|edit] + optional target [config|ci|both]
> parse: mode:verify|local|fix|edit target:config|ci|both
> out:
> →wrangler.jsonc
> →drizzle.config.ts
> →.github/workflows/ci.yml
> deps: Node 20, wrangler (npx), pnpm, Biome

## Modes

- **verify** (default): cross-check `wrangler.jsonc` + `.github/workflows/ci.yml` + `package.json` scripts + `drizzle.config.ts`. Report drift. No edits.
- **local**: run the local build validate sequence (`pnpm typecheck` → `npx wrangler deploy --dry-run`). Optionally start `wrangler dev` for a runtime smoke test and probe the local URL.
- **fix**: apply the drift fixes that verify mode found (missing `nodejs_compat` flag, stale `compatibility_date`, missing binding declaration, mismatched script names).
- **edit**: targeted edit driven by $ARGUMENTS prose (e.g. "add a D1 binding for analytics", "bump compatibility_date to 2026-04-05", "add SENTRY_DSN var to wrangler.jsonc").

## Verify checklist (in order)

1. `wrangler.jsonc` has `main: "src/index.ts"` and a `compatibility_date` no older than 6 months.
2. `compatibility_flags` includes `"nodejs_compat"` if any code imports `node:*` built-ins; absent otherwise.
3. Every `c.env.*` binding referenced in `src/env.ts` (`Bindings`) has a matching entry in `wrangler.jsonc` (`d1_databases` with binding `DB`, `vars`, `kv_namespaces`, `r2_buckets`, etc.).
4. `drizzle.config.ts` driver matches the deployment target; `dbCredentials` reads from env vars, not hardcoded values.
5. `.github/workflows/ci.yml` runs on Node 20 (`actions/setup-node` with `node-version: '20'`).
6. CI steps in order: setup pnpm → `pnpm install` → `pnpm check` → `pnpm typecheck` → `pnpm test` → `npx wrangler deploy --dry-run`.
7. `concurrency.group` keys on `github.ref` so PR and main runs do not share slots.
8. No `#` comments in workflow YAML (step `name:` is the label; rationale lives in `docs/`).
9. `package.json` scripts include `check`, `typecheck`, `test`, and `db:generate`.

## "Build broken" triage guide

| Symptom | Likely cause | Fix |
|---|---|---|
| `ReferenceError: Buffer is not defined` | Node built-in used without `nodejs_compat` | Add `"nodejs_compat"` to `compatibility_flags` in `wrangler.jsonc` |
| `Unknown binding` / `env.X is undefined` | Binding declared in code but missing in `wrangler.jsonc` | Add the binding under the correct key (`d1_databases`, `vars`, etc.) |
| `Compatibility date … is too old` | Stale `compatibility_date` | Bump to a recent date in `wrangler.jsonc` |
| `Type error: Property X does not exist on Bindings` | `src/env.ts` `Bindings` out of sync with `wrangler.jsonc` | Sync the two; run `pnpm typecheck` to verify |
| CI fails at `wrangler deploy --dry-run` but passes locally | `CLOUDFLARE_API_TOKEN` secret missing in repo settings, or `account_id` absent in `wrangler.jsonc` | Add the secret / `account_id`; dry-run does not publish but still authenticates |
| `Cannot find module '…'` in bundle | ESM extension omitted on local import | Add `.js` extension to the import path (Workers ESM requires it) |

## Drift fixes (mode=fix)

Print every drift item first: `file:line → current → proposed`. Then apply with Edit — single edit per file, never partial. Re-run verify after.

## Local build validate (mode=local)

```
pnpm typecheck
npx wrangler deploy --dry-run
```

For a runtime smoke test:

```
npx wrangler dev
```

`wrangler dev` uses `.dev.vars` for env bindings — create it from `.dev.vars.example` if absent. D1 migrations must be applied locally via `npx wrangler d1 migrations apply DB --local` before the dev server starts.

## wrangler.jsonc reference shape

```jsonc
{
  "name": "hahaton-2026",
  "main": "src/index.ts",
  "compatibility_date": "2026-04-05",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "hahaton",
      "database_id": "<uuid>",
      "migrations_dir": "src/db/migrations"
    }
  ],
  "vars": {
    "ENVIRONMENT": "production"
  }
}
```

Key fields:
- `main` must be `"src/index.ts"` — the Hono app entry point.
- `compatibility_date` — keep within 6 months; phasekit reference uses `"2026-04-05"`.
- `compatibility_flags: ["nodejs_compat"]` — required for any `node:*` import (crypto, path, Buffer, etc.).
- `d1_databases[].binding` must be `"DB"` to match `getDb(c)` in `src/db/client.ts`.
- `vars` — non-secret runtime config; secrets go to `wrangler secret put` / `.dev.vars` locally.
- `drizzle.config.ts` — sits alongside `wrangler.jsonc`; its `out` must point to `src/db/migrations/`.

## .github/workflows/ci.yml reference shape

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          version: latest

      - name: Set up Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run Biome check
        run: pnpm check

      - name: Run typecheck
        run: pnpm typecheck

      - name: Run tests
        run: pnpm test

      - name: Verify wrangler bundle (dry-run)
        run: npx wrangler deploy --dry-run
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Out-of-scope

Actual deploy / secret rotation / rollback → `/deploy`. Lint / format fixes → `/lint`, `/fmt`. New route or service scaffolding → `/api`. DB schema changes → `/db`. New utility functions → `/lib`.

$ARGUMENTS
