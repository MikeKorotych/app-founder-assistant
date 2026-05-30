---
description: Verify + edit deploy infra (wrangler environments, secrets, rollback) for Cloudflare Workers. Auto-routes on "deploy / rollback / what's on prod / safe to ship".
---

> in: $ARGUMENTS = mode [verify|deploy|rollback|edit-docs] + optional env [staging|production]
> parse: mode:verify|deploy|rollback|edit-docs env:staging|production
> out:
> →wrangler.jsonc (env blocks only — route/binding structure belongs to /build)
> →docs/release.md
> deps: wrangler CLI (npx wrangler), gh CLI (branch-protection read)

## Pre-flight rules (see ../../docs/stack.md)

- **No comments** — see [Comments policy](../../docs/stack.md#comments-policy). No `//`, `/* */`, JSDoc; only tooling pragmas.
- **No default exports** — see [No default exports](../../docs/stack.md#no-default-exports). ESM only.
- **Deterministic names** — see [Deterministic naming](../../docs/stack.md#deterministic-naming). kebab-case files, CONSTANT_CASE scalars.
- **No magic numbers** — see [Magic numbers](../../docs/stack.md#magic-numbers).
- **Self-check before done** — see [Self-check](../../docs/stack.md#self-check-before-declaring-a-task-done). Run `pnpm check` + `pnpm typecheck`.

## Modes

- **verify** (default): audit deploy readiness. Print environment blocks found in `wrangler.jsonc` (`env.staging` / `env.production`), last deployment via `npx wrangler deployments list`, secrets presence checklist per env (read from `docs/release.md`), and whether any pending D1 schema migrations exist (`npx wrangler d1 migrations list DB --remote`). Reports gaps. No mutations.
- **deploy**: print the exact wrangler commands to deploy — `npx wrangler deploy` (production) or `npx wrangler deploy --env staging` (staging). If schema has changed since last migration, prepend `npx wrangler d1 migrations apply <DB> --remote` (see `/db`). Does NOT execute — print only, operator runs them.
- **rollback**: read the prior successful deployment via `npx wrangler deployments list`, print `npx wrangler rollback [--deployment-id <id>] [--message "reason"]` and the version ID to restore. Does NOT execute — print only.
- **edit-docs**: edit `docs/release.md` per $ARGUMENTS prose.

## wrangler.jsonc env blocks

Environments live under the top-level `env` object in `wrangler.jsonc`. Each environment block redeclares its own `vars`, `d1_databases` (binding `DB`), and any other bindings — no cross-env inheritance. Standard environment names are `staging` and `production`. The `dev` block is local-only and never deployed.

Pattern (from phasekit reference):

```jsonc
{
  "name": "<worker-name>",
  "main": "src/index.ts",
  "compatibility_date": "2026-04-05",
  "compatibility_flags": ["nodejs_compat"],

  "env": {
    "staging": {
      "vars": { "APP_ENV": "staging" },
      "d1_databases": [{ "binding": "DB", "database_name": "<name>-staging", "database_id": "<id>", "migrations_dir": "src/db/migrations" }]
    },
    "production": {
      "vars": { "APP_ENV": "production" },
      "d1_databases": [{ "binding": "DB", "database_name": "<name>-prod", "database_id": "<id>", "migrations_dir": "src/db/migrations" }]
    }
  }
}
```

JSONC comments (`//`) appear in phasekit's own source — do not copy them here. Rationale belongs in `docs/release.md` per [Comments policy](../../docs/stack.md#comments-policy).

## Verify checklist (in order)

1. `wrangler.jsonc` exists and has a top-level `name` field.
2. `env.staging` and `env.production` blocks exist in `wrangler.jsonc`.
3. Each env block specifies its own `vars` and `d1_databases` — no bleed between environments.
4. D1 binding `DB` (or the name from `src/env.ts` `Bindings`) is declared in each env block with a distinct `database_name` and `database_id`.
5. `docs/release.md` exists and is current (verify mode creates a skeleton if missing — see contract below).
6. Branch protection on `main` requires at minimum the CI typecheck + test checks. If `gh` is not authenticated, advise the user — this skill does NOT modify branch-protection rules.
7. Required secrets are set per env: run `npx wrangler secret list --env production` and `npx wrangler secret list --env staging`; diff against the `docs/release.md` secrets checklist. All secret names must appear in `src/env.ts` `Bindings` (zod-validated via `validateEnv`).
8. No pending D1 migrations: run `npx wrangler d1 migrations list DB --remote` and compare to local `src/db/migrations/` directory.

## docs/release.md contract

When verify mode reports missing or stale, create/refresh with these sections in this order:

1. `## Build` — link to /build skill + [wrangler.jsonc](../../wrangler.jsonc)
2. `## Environments` — staging vs production env blocks, `database_name`/`database_id`, `vars`
3. `## Deploy` — `npx wrangler deploy` (production) and `npx wrangler deploy --env staging` (staging); note that schema migrations (`npx wrangler d1 migrations apply DB --remote`) MUST run before deploy when schema has changed — link to `/db`
4. `## Gradual deployments / version IDs` — how to use `npx wrangler versions upload` + `npx wrangler versions deploy` for traffic splitting; when to prefer over direct deploy
5. `## Rollback` — `npx wrangler rollback [--deployment-id <id>]`; how to get the prior version ID from `npx wrangler deployments list`; D1 time-travel bookmark via `npx wrangler d1 time-travel` before rollback when schema changed
6. `## Secrets` — checklist of required secret keys per env; set via `npx wrangler secret put NAME [--env staging]`; local dev uses `.dev.vars` (never committed); typed in `src/env.ts` `Bindings`
7. `## Logs` — `npx wrangler tail` (production) and `npx wrangler tail --env staging`; structured log format via `createLogger` from `src/utils/logger.ts`
8. `## Safe-to-ship gate` — CI green on `main`, migrations applied, secrets verified, rollback plan confirmed; run full gate via `/p-ship`

The release.md is the canonical deploy procedure — wrangler config rationale lives here, NOT in comments inside `wrangler.jsonc`.

## Deploy mode output template

```
# --- staging ---
npx wrangler d1 migrations apply DB --remote --env staging   # only if schema changed
npx wrangler deploy --env staging

# --- production ---
npx wrangler d1 time-travel restore DB --remote              # bookmark before schema rollout
npx wrangler d1 migrations apply DB --remote                 # only if schema changed
npx wrangler deploy
```

Verify green CI on `main` before running the production block. Ship via `/p-ship` for the full gating flow.

## Rollback mode safety

Always print BOTH the current deployment ID AND the target rollback deployment ID so the operator can confirm direction before running. Fetch the list with:

```
npx wrangler deployments list
```

Then print the rollback command:

```
npx wrangler rollback --deployment-id <prev-id> --message "reason for rollback"
```

For schema changes, bookmark D1 before the deploy so time-travel restore is available:

```
npx wrangler d1 time-travel restore DB --timestamp <iso-before-deploy> --remote
```

Never auto-execute — rollback is a stateful destructive action. See [Self-check](../../docs/stack.md#self-check-before-declaring-a-task-done).

## Secrets management

- Set per env: `npx wrangler secret put NAME` (production) or `npx wrangler secret put NAME --env staging`.
- List: `npx wrangler secret list [--env staging]`.
- Local dev: `.dev.vars` file (KEY=value, never committed — confirm in `.gitignore`).
- All secret names must be declared in `src/env.ts` `Bindings` and validated via `validateEnv(c.env)`. Read via `c.env.*` — never `process.env` in request paths.

## D1 migrations before deploy

If `src/db/schema/` has changed since the last applied migration, run migrations BEFORE deploying the Worker — a new Worker binding a schema the old D1 does not have will fail at runtime. See `/db` for the full migration workflow.

```
npx wrangler d1 migrations apply DB --remote                  # production
npx wrangler d1 migrations apply DB --remote --env staging    # staging
```

`migrations_dir` in `wrangler.jsonc` must point to `src/db/migrations` (single-package layout — no `packages/db/` split).

## What's on prod

```
npx wrangler deployments list          # last N deployments with version IDs + timestamps
npx wrangler tail                      # live log stream from production
npx wrangler tail --env staging        # live log stream from staging
```

## Gradual deployments

For risky changes, use version-based traffic splitting instead of direct deploy:

1. `npx wrangler versions upload` — upload new version without activating.
2. `npx wrangler versions deploy` — split traffic (e.g., 10% new / 90% old).
3. Monitor with `npx wrangler tail`; promote to 100% or rollback.

Version IDs are the stable handles for rollback; prefer them over timestamp-based identification.

## Hook integration

The deploy-verify portion (env blocks + secrets checklist + migration status) backs the pre-ship gate in `/p-ship`. If you tighten deploy gates (new required secret, new migration step), update BOTH this skill's verify checklist AND `docs/release.md` `## Safe-to-ship gate`.

Stack conventions live in [docs/stack.md](../../docs/stack.md). Release procedure lives in [docs/release.md](../../docs/release.md).

## Out-of-scope

Worker source structure / route wiring / binding declarations → /build. DB schema changes + local migration generation → /db. Lint / format / test gating → /lint, /fmt, /p-ship. Outbound provider setup → /provider.

$ARGUMENTS
