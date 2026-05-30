# Stack & conventions — `hahaton-2026`

Anchor doc for the `.claude/commands/*` skills. Conventions mirror the team's
Cloudflare reference repo **phasekit**, projected onto this repo's **single-package
`src/` layout** (phasekit is a pnpm/turbo monorepo; we are one package). Where a skill
links a code-style rule, it points to a section here.

## Target stack

| Concern | Choice | Notes |
|---|---|---|
| Runtime | **Cloudflare Workers** | Deploy target. Web-standard APIs only (`fetch`, `Request`, `Response`, `crypto`, `URL`, `TextEncoder`, `AbortController`). Node built-ins only with `nodejs_compat` in `wrangler.jsonc`. |
| HTTP framework | **Hono** | `src/index.ts` creates `new Hono<BaseEnv>()`, applies global middleware, registers routes via `app.route('/{e}s', {e}Routes)`, and `export default { fetch: app.fetch }` (+ `scheduled` if cron). |
| Validation | **@hono/zod-validator** | `zValidator('json'|'query'|'param', schema)`; read with `c.req.valid('json')`. Zod schema is the single source of truth. |
| ORM / DB | **Drizzle** on **D1** (SQLite) | Schema in `src/db/schema/{entity}.ts`; migrations in `src/db/migrations/`; client via `getDb(c)` factory (`src/db/client.ts`), never inline. Timestamps are `integer('col', { mode: 'timestamp' })`, NOT ISO text. |
| Config / secrets | **Workers env bindings** | Read via `c.env.*`. Typed `Bindings` + `validateEnv(c.env)` zod schema in `src/env.ts`. Local: `.dev.vars`; prod: `wrangler secret put`. Never `process.env` in request paths. |
| Lint / format | **Biome** | `pnpm check` (= `biome check .`), `pnpm check:fix` (`--write`), `pnpm format` (`biome format . --write`). One root `biome.json`. No ESLint, no Prettier. |
| Tests | **Vitest** (+ `@cloudflare/vitest-pool-workers`) | Plain vitest for pure units/mappers; pool-workers for tests touching `c.env`/D1. Factory helpers `make{Entity}(overrides)`. |
| Package manager | **pnpm** | Single package (no turbo `--filter` here). Scripts: `check`, `format`, `typecheck`, `test`, `db:generate`, `db:migrate`. |
| Outbound HTTP | **`src/outbound/`** | Ported `OutboundHttpClient` (fetch — native on Workers) + `withRetry` + `CircuitBreaker` + error taxonomy + `safeNormalize`. Provider clients extend it. See the `/provider` skill. |

## Repo layout (single package)

```
src/
  index.ts            # Hono app + Worker fetch handler (+ scheduled)
  env.ts              # Bindings type + validateEnv(c.env) zod schema
  routes/{e}.ts       # one Hono sub-app per entity, export { app as {E}Routes }   [/api]
  middleware/{m}.ts   # Hono middleware (createMiddleware)                          [/mw]
  services/{e}.service.ts  # business logic over getDb(c) + providers
  db/
    schema/{e}.ts     # Drizzle sqliteTable + indexes + Row/Insert types           [/db]
    client.ts         # getDb(c) factory
    migrations/       # generated SQL
  integrations/{name}/ # external-API provider                                     [/provider]
    {name}.provider.ts # interface impl, delegates to client + mapper
    http-client.ts     # extends OutboundHttpClient (transport only)
    mapper.ts          # raw → Normalized*, wrapped in safeNormalize
    config.ts          # endpoints, RETRY_CONFIG, BATCH_SIZE (as const)
    errors.ts          # errorMapper → Outbound* / {Name}ApiError
  outbound/           # shared HTTP resilience layer (ported)
  types/{domain}.ts   # branded IDs, const+keyof unions, Normalized*/External*     [/type]
  lib/{name}.ts       # pure shared utils                                          [/lib]
  utils/logger.ts     # createLogger(scope)                                        [/log]
  constants/
    errors.ts         # ErrorCode (HTTP) + InternalError (throws)
    http.ts           # RouteParam, QueryParam, RequestHeader
__tests__/{name}.test.ts   # colocated vitest                                      [/test]
wrangler.jsonc · drizzle.config.ts · biome.json · vitest.config.ts
```

Bracketed = owning skill. There is no `apps/*`/`packages/*` split — everything is `src/`.

## Convention cheat-sheet (phasekit monorepo → here)

| phasekit (monorepo) | here (single package) |
|---|---|
| `apps/drift/src/routes/{E}.ts` | `src/routes/{e}.ts` |
| `apps/drift/src/middleware/{M}.ts` | `src/middleware/{m}.ts` |
| `apps/drift/src/utils/{logger,db,crypto}.ts` | `src/utils/*.ts`, `src/db/client.ts` |
| `apps/drift/src/constants/{errors,http}.ts` | `src/constants/{errors,http}.ts` |
| `packages/db/src/schema/{E}.ts` + `packages/db/migrations/` | `src/db/schema/{e}.ts` + `src/db/migrations/` |
| `packages/types/src/{domain}.ts` | `src/types/{domain}.ts` |
| `packages/{name}-client/src/*` | `src/integrations/{name}/*` |
| `packages/{domain}/src/{name}.ts` (shared lib) | `src/lib/{name}.ts` |
| `pnpm --filter @phasekit/db generate` | `pnpm db:generate` |
| `getDb(c)` from `apps/drift/src/utils/db.ts` | `getDb(c)` from `src/db/client.ts` |

---

# Code style

Mirrors phasekit's enforced rules (Biome + CLAUDE.md). Skills link to these sections.

## Comments policy

No comments in source — no `//`, no `/* */`, no JSDoc. Knowledge lives in skills/docs/types, not `.ts`. **Only exception**: tooling pragmas (`biome-ignore`, `ts-expect-error`, `@vite-ignore`). When you remove a comment that carried information, move it to the owning doc/skill in the same change. A comment is a signal the name is wrong — rename instead (`// retry 3x` → `const MAX_RETRIES = 3`, counter `attempt`).

## No default exports

One named export per module (Biome `noDefaultExport: error`). Import types with `import type` (`useImportType: error`). ESM only (`noCommonJs`).

## No enums — const + keyof

No TS `enum`. Closed-set values are a `PascalCase as const` object with `PascalCase` keys + a derived `keyof typeof` type, in a `constants/`/`types/` module. Keys are PascalCase; values are the wire format (SCREAMING_SNAKE for external APIs, snake_case for internal). Never inline string literals for enum-like values — import the const (`CampaignStatus.Active`, `EntitySyncStatus.Pending`).

## Branded IDs

Entity IDs are branded: `type UserId = string & { readonly __brand: unique symbol }`. Any function taking an ID takes the branded type, not bare `string`.

## No any

No `any`. Use `unknown` at boundaries and narrow. No `as` casts for Drizzle columns — type at the schema via `$type<T>()`.

## Deterministic naming

Verbs for functions (`resolveUserFromAuthHeader`, not `getUser`). `is/has/should/can` for booleans. Plural + qualifier for collections (`pendingJobs`). Filenames **kebab-case**; types **PascalCase**; vars **camelCase**; module-scope scalars **CONSTANT_CASE**. If a name needs >4 words to disambiguate, split the function.

## Magic numbers

Numeric literals with domain meaning (timeouts, retry budgets, HTTP thresholds, unit factors) become named `CONSTANT_CASE` consts at module top (or a `*.constants.ts` / `src/lib/time.ts` when shared — e.g. `DAY_MS`, `WEEK_MS`). Pairs as objects (`RETRY_CONFIG = { maxRetries: 4, baseDelayMs: 1_000 }`). Identity arithmetic (`0`/`1`/`-1`, `slice(0, n)`, `length - 1`) stays inline. No inline time math.

## Backend rules (Workers/Hono/Drizzle)

- No raw `console.*` — `createLogger(scope)` from `src/utils/logger.ts`; structured `log.info/warn/error(msg, { flatData })`.
- No inline error strings — `ErrorCode.*` (HTTP responses via `errorResponse(c, status, ErrorCode.X)`) / `InternalError.*` (throws + logged).
- No inline route/query/header strings — `RouteParam.*`, `QueryParam.*`, `RequestHeader.*` from `src/constants/http.ts`.
- No `db.transaction()` — D1 has no explicit BEGIN/COMMIT; sequence queries. Fetch external data first, then write.
- Web-standard APIs only — no `Buffer`/`path`/`node:*` unless `nodejs_compat` is set.
- List endpoints default sort newest-first (`desc(table.createdAt)`); soft-delete via `deletedAt`, queries filter `isNull(deletedAt)`.
- Never log secrets, tokens, PII, full request bodies, or LLM prompts/responses; log `err.message`/`err.name`/`OutboundError.kind`, not raw `Error` objects.

## Self-check before declaring a task done

Before reporting done: re-read every line you emitted; `grep` for `//`, `/* */`, default exports, `any`, raw `console.`, inline enum-like strings. Any non-pragma hit = not done — rename, delete, or hoist to the owning doc. Run `pnpm check` + `pnpm typecheck`.
