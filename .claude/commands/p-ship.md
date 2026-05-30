---
description: Ship-readiness pipeline — test → check (Biome) → typecheck → build (wrangler dry-run) → deploy verify. Auto-routes on "ship / release / is this ready / pre-merge".
---

> in: $ARGUMENTS = optional --skip-deploy (skip wrangler deployments list when no remote credentials are available)
> parse: skip_deploy:bool
> out: composes →/test, →/lint, →/fmt, →/build, →/deploy (no direct file output)
> deps: node 20, pnpm, wrangler CLI (npx), vitest, biome

## Pre-flight rules (see ../../docs/stack.md)

- **No comments** — see [Comments policy](../../docs/stack.md#comments-policy). No `//`, `/* */`, JSDoc; only tooling pragmas.
- **Self-check before done** — see [Self-check](../../docs/stack.md#self-check-before-declaring-a-task-done). Run `pnpm check` + `pnpm typecheck`.

## Pipeline steps

Each step is fail-fast — the first non-zero exit aborts. The pipeline does NOT batch errors. Fix, re-run.

1. **Run tests** (`/test`) — `pnpm test` (vitest; `@cloudflare/vitest-pool-workers` pool for tests that touch `c.env`/D1 bindings). `/test` is the codegen skill; running the suite here is a shell-thin step.
2. **Lint + format check** (`/lint`) — `pnpm check` (= `biome check .`); single Biome gate covering both lint and format. Aborts on any violation. Note: `/fmt` is the format-only subset (`pnpm format`); here the unified `check` gate is used. User fixes with `pnpm check:fix` and re-runs `/p-ship`.
3. **Typecheck** — `pnpm typecheck` (`tsc --noEmit`). Aborts on type errors. No separate skill ref — this is a direct shell step.
4. **Build verify** (`/build`) — `npx wrangler deploy --dry-run` verifies the bundle compiles, asset references resolve, and `wrangler.jsonc` is valid. Aborts on any non-zero exit.
5. **Deploy verify** (`/deploy`) — audit `wrangler.jsonc` env bindings; confirm all secrets are declared in `src/env.ts` (`Bindings` + `validateEnv`) and set (`wrangler secret list`); check pending D1 migrations via `wrangler d1 migrations list --remote`; run `wrangler deployments list` to confirm the worker is reachable. Skipped if `--skip-deploy`. See [stack.md — Target stack](../../docs/stack.md#target-stack) and the [/deploy](deploy.md) + [/db](db.md) skills.
6. **Summary** — green/red per step. On failure, print the exact next-action command the user should run.

## D1 schema changes

If `src/db/schema/` was modified since the last deploy, migrations must be generated and applied before step 5 passes:

```sh
pnpm db:generate
npx wrangler d1 migrations apply <DB_NAME> --remote
```

D1 schema changes need `wrangler d1 migrations apply DB --remote` as part of deploy. Use the [/db](db.md) skill to scaffold schema changes and the [/deploy](deploy.md) skill to wire the migration into the deploy flow.

## Why the pipeline is read-mostly

Steps 1–5 are verify/check shape. Mutations only happen when the user opts in between iterations (`pnpm check:fix`, hand edits to schema / wrangler config). The pipeline never silently applies fixes — visibility over autopilot.

## Fail-fast policy

| Step             | Failure mode                                               | Recovery                                                                                  |
| ---------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1 tests          | vitest non-zero                                            | Fix the failing tests, re-run `/p-ship`                                                   |
| 2 check (Biome)  | Biome lint or format violation                             | `pnpm check:fix` then re-run; manual rename if not autofix-able (`/lint`)                 |
| 3 typecheck      | TypeScript error                                           | Fix type errors, re-run                                                                   |
| 4 build verify   | wrangler dry-run failure                                   | Fix `wrangler.jsonc` drift or bundle error, re-run (`/build`)                             |
| 5 deploy verify  | Missing binding / unapplied migration / unreachable worker | `/db` to generate + apply migrations; `wrangler secret put` for missing secrets; `/deploy` to fix config |

## Out-of-scope

- Actual `wrangler deploy` to production — this pipeline only verifies readiness. Run `wrangler deploy` manually or via CI after the pipeline is green.
- Secret value management — use `wrangler secret put <NAME>` manually. Step 5 only checks that declared secrets exist, not their values.
- Branch-protection edits — manual via GitHub repo Settings. This pipeline reports gaps; it cannot mutate repo settings.
- New-binding onboarding — update `src/env.ts` (`Bindings`), `wrangler.jsonc`, and `.dev.vars`; then extend `/deploy` via `/sk`.

## When to run

- Before opening a PR — sanity check that CI jobs will pass.
- Before pressing merge on `main` — pair with the GitHub-side required-checks gate.
- After a non-trivial `wrangler.jsonc` or schema edit — step 4/5 catches drift unit tests cannot see.
- Periodically (e.g. weekly) — `/loop 7d /p-ship` to catch silent config drift.

## Stack reference

See [docs/stack.md](../../docs/stack.md) for the full stack and conventions, including:

- [Target stack](../../docs/stack.md#target-stack) — runtime, ORM, config, deploy choices.
- [Comments policy](../../docs/stack.md#comments-policy) — no inline comments.
- [Self-check before declaring a task done](../../docs/stack.md#self-check-before-declaring-a-task-done) — `pnpm check` + `pnpm typecheck`.

$ARGUMENTS
