---
description: Full CRUD pipeline for a local entity (type → db → service → api → log → test)
---

## Pre-flight rules (see ../../docs/stack.md)

- **No comments** — see [Comments policy](../../docs/stack.md#comments-policy). No `//`, `/* */`, JSDoc; only tooling pragmas. A comment means the name is wrong — rename.
- **No default exports** — see [No default exports](../../docs/stack.md#no-default-exports). One named export per module; `import type` for types; ESM only.
- **No enums — const + keyof** — see [No enums — const + keyof](../../docs/stack.md#no-enums--const--keyof). Closed-set values are a `PascalCase as const` object + `keyof typeof` type; never inline enum-like strings.
- **Branded IDs** — see [Branded IDs](../../docs/stack.md#branded-ids). ID params use the branded type, not bare `string`.
- **No `any`** — see [No any](../../docs/stack.md#no-any). `unknown` at boundaries; `$type<T>()` not `as` for Drizzle columns.
- **Deterministic names** — see [Deterministic naming](../../docs/stack.md#deterministic-naming). Verb fns, `is/has/should` booleans; kebab-case files, PascalCase types, camelCase vars, CONSTANT_CASE scalars.
- **No magic numbers** — see [Magic numbers](../../docs/stack.md#magic-numbers). Domain literals → named consts; pairs as `as const` objects.
- **Backend rules** — see [Backend rules](../../docs/stack.md#backend-rules-workershonodrizzle). `createLogger` not `console.*`; `ErrorCode`/`InternalError` not raw strings; no `db.transaction()`; web-standard APIs only.
- **Self-check before done** — see [Self-check](../../docs/stack.md#self-check-before-declaring-a-task-done). Re-read, grep for comments/defaults/`any`/`console`; run `pnpm check` + `pnpm typecheck`.


> in: $ARGUMENTS = entity name + fields
> parse: entity, fields
> out:
> →src/types/{entity}.ts (branded ID + status const + Normalized* interface)
> →src/db/schema/{entity}.ts (Drizzle table + indexes + Row/Insert types)
> →src/services/{entity}.service.ts (CRUD over getDb(c), isNull(deletedAt), offset pagination)
> →src/routes/{entity}.ts (Hono sub-app, zValidator, calls service)
> →src/index.ts (route registered)
> deps: getDb(c) from src/db/client.ts; Hono app at src/index.ts; zod; createLogger from src/utils/logger.ts; ErrorCode from src/constants/errors.ts

> pipeline: sequential, context-forward
> product context: standard CRUD pipeline for **local / provider-agnostic** entities (e.g. `report`, `session`, `result`). Use this for entities owned entirely in D1 — source of truth is the DB. For entities synced from an external API, scaffold the provider layer first with `/provider`, then run this pipeline for the local read surface. Entity names are identical across types, DB schema, service, and routes — a `Report` entity lives at `src/types/report.ts`, `src/db/schema/report.ts`, `src/services/report.service.ts`, `src/routes/report.ts`. No UI-vs-code naming split.

Execute in order. Each step imports from previous outputs.

### 1. @type $ARGUMENTS

→`src/types/{entity}.ts`

Creates:

- `{Entity}Id` branded type: `type {Entity}Id = string & { readonly __brand: unique symbol }`.
- `make{Entity}Id(raw: string): {Entity}Id` cast factory.
- `{Entity}Status` — PascalCase `as const` object + `type {Entity}Status = typeof {Entity}Status[keyof typeof {Entity}Status]` (omit if entity has no status field).
- `Normalized{Entity}` interface: camelCase fields, timestamps as `number` (unix ms), IDs as branded types.
- `Create{Entity}Input` and `Update{Entity}Input` plain TS interfaces (derived from zod in step 4 via `z.infer` — define shapes here, cross-validate there).

### 2. @db $ARGUMENTS using types from step 1

→`src/db/schema/{entity}.ts` + migration

Creates a Drizzle `sqliteTable` with:

- Primary key: `id text("id").primaryKey()` — seeded with `crypto.randomUUID()` at insert time.
- All requested fields with appropriate Drizzle column types. Integer timestamps: `integer("{col}", { mode: "timestamp" })`, NOT ISO text.
- `createdAt integer("created_at", { mode: "timestamp" }).notNull()`.
- `updatedAt integer("updated_at", { mode: "timestamp" }).notNull()`.
- `deletedAt integer("deleted_at", { mode: "timestamp" })` — nullable; soft-delete sentinel.
- `Row` type alias: `typeof {table}.$inferSelect`.
- `Insert` type alias: `typeof {table}.$inferInsert`.
- Indexes: at minimum one on `createdAt` for list ordering.

Migration: write the schema change; the human runs `pnpm db:generate` then `pnpm db:migrate` (needs D1 binding + consent). Never auto-run migrations.

### 3. Service `src/services/{entity}.service.ts`

Plain module (no DI, no decorators). Resolves `db` via `getDb(c)` passed from the route handler — never imports `c.env` directly.

| Export | Signature | Notes |
|---|---|---|
| `list{Entity}s` | `(db, opts: List{Entity}Opts) => Promise<Normalized{Entity}[]>` | `List{Entity}Opts`: `limit: number`, `offset: number`; filter `isNull(table.deletedAt)`; order `desc(table.createdAt)` |
| `fetch{Entity}ById` | `(db, id: {Entity}Id) => Promise<Normalized{Entity} \| null>` | Returns `null` when not found or soft-deleted (`isNull(deletedAt)`) |
| `create{Entity}` | `(db, input: Create{Entity}Input) => Promise<Normalized{Entity}>` | Generates PK via `crypto.randomUUID()`; sets `createdAt`/`updatedAt` to `Date.now()` |
| `update{Entity}` | `(db, id: {Entity}Id, patch: Update{Entity}Input) => Promise<Normalized{Entity} \| null>` | Returns `null` when not found or soft-deleted; updates `updatedAt` |
| `delete{Entity}` | `(db, id: {Entity}Id) => Promise<boolean>` | Soft-delete: sets `deletedAt = Date.now()`; returns `false` when not found or already deleted |

Rules:

- Pagination is offset-based: `limit(opts.limit).offset(opts.offset)`.
- All row→domain mapping lives in a colocated `src/services/{entity}.mapper.ts` — pure `mapRow{Entity}(row: Row): Normalized{Entity}`.
- Use `createLogger("{entity}.service")` from `src/utils/logger.ts`; `log.info/warn/error` at mutations, not-found branches, and caught errors.
- Error responses use `ErrorCode.*` / `InternalError.*` from `src/constants/errors.ts`; never raw strings.
- No `db.transaction()` — D1 has no explicit BEGIN/COMMIT; sequence queries.

### 4. @api $ARGUMENTS actions=GET,POST,PATCH,DELETE

→`src/routes/{entity}.ts` + register in `src/index.ts`

Creates a Hono sub-app (`new Hono<BaseEnv>()`) exported as `{entity}Routes`:

| Method | Path | Handler |
|---|---|---|
| `GET` | `/{entity}s` | `zValidator("query", List{Entity}QuerySchema)` → `list{Entity}s(getDb(c), opts)` → `c.json(rows, 200)` |
| `GET` | `/{entity}s/:id` | param `:id` → `fetch{Entity}ById` → 404 if `null` → `c.json(row, 200)` |
| `POST` | `/{entity}s` | `zValidator("json", Create{Entity}Schema)` → `create{Entity}` → `c.json(row, 201)` |
| `PATCH` | `/{entity}s/:id` | `zValidator("json", Update{Entity}Schema)` → `update{Entity}` → 404 if `null` → `c.json(row, 200)` |
| `DELETE` | `/{entity}s/:id` | param `:id` → `delete{Entity}` → 404 if `false` → `c.json({ deleted: true }, 200)` |

Zod schemas (colocated; extract to `src/routes/{entity}.schemas.ts` when file exceeds ~120 lines):

```ts
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const List{Entity}QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
});

const Create{Entity}Schema = z.object({ /* fields */ });
const Update{Entity}Schema = Create{Entity}Schema.partial();
```

Route file: routing only — parse → call one service fn per handler → return `c.json`. No Drizzle queries, no business logic, no try/catch orchestration in the route layer. Resolve DB via `getDb(c)` from `src/db/client.ts`.

Register in `src/index.ts`:

```ts
import { {entity}Routes } from "./routes/{entity}.js";

app.route("/", {entity}Routes);
```

Use `.js` extension (ESM, Workers runtime). Append after existing mounts; do not reorder.

### 5. @log scope=route on mutations

Adds `createLogger("{entity}.route")` from `src/utils/logger.ts` to the route file created in step 4. Structured `log.info` on successful mutation response (POST/PATCH/DELETE); `log.warn` on 404 branches; `log.error` on unexpected throws. Never log secrets, tokens, PII, full request bodies, or LLM prompts/responses — log `err.message`/`err.name` only.

### 6. @test vitest factory tests

→`__tests__/{entity}.service.test.ts`
→`__tests__/{entity}.route.test.ts`

Creates:

- `make{Entity}(overrides?: Partial<Normalized{Entity}>): Normalized{Entity}` factory — deterministic defaults, no random data.
- `makeDb{Entity}Row(overrides?): Row` factory for raw DB rows.
- Service tests: mock or inject Drizzle client; cover `list`, `fetchById`, `create`, `update`, `delete`, soft-delete round-trip.
- Route tests: Hono `app.request(...)` test helper; cover 404 on unknown ID, 201 on create, 200 on update, 200 on delete, 400 on zod-invalid body.
- Use `@cloudflare/vitest-pool-workers` only when tests touch `c.env.*` bindings; plain vitest otherwise.
- Only `vi.*`, `describe`, `it`, `expect` from vitest — no `jest.*` APIs.

### Verify

Run `pnpm check` + `pnpm typecheck` + `pnpm test`. Fix all errors before reporting done.

---

## Idempotency

- Before each step, check if the output file exists.
- If exists and content matches intent → skip step, log `skipped — already exists`.
- If exists but needs update (new fields) → Edit in place, never Write-overwrite.
- Barrel exports (`src/types/index.ts` if present): append new entries, do not duplicate.
- Running the pipeline twice for the same entity with the same fields = no changes.

## Notes

- For LOCAL/provider-agnostic entities only. Synced/external entities: use `/provider` first.
- Integer timestamps (`{ mode: "timestamp" }`) throughout — not ISO text strings.
- Soft-delete via `deletedAt`; list + fetch always filter `isNull(deletedAt)`.
- Offset pagination (not cursor) — `limit` + `offset` from query params.
- 404, never 403, for missing/soft-deleted rows. `DELETE` returns `{ deleted: true }` on success.
- PK always `crypto.randomUUID()` — web-standard, no Node dependency.

$ARGUMENTS
