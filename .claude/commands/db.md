---
description: Scaffold a D1/Drizzle table + migration
---
>in: $ARGUMENTS = entity name + fields + mode(local|synced)
>parse: E:name fields[]={col:sqliteType} mode:local|synced
>out: →src/db/schema/{e}.ts →src/db/migrations/{yyyyMMddHHmm}_{e}.sql
>deps: drizzle-orm, drizzle-orm/sqlite-core

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

## Schema →src/db/schema/{e}.ts

mode=local (standalone entity, no external sync):
```ts
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

export const {e}s = sqliteTable('{e}s', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  {fields→drizzle: text→text('x'), int→integer('x'), num→real('x'), bool→integer('x', { mode: 'boolean' })},
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (t) => [
  index('idx_{e}s_created').on(t.createdAt),
])

export type {E}Row = InferSelectModel<typeof {e}s>
export type {E}Insert = InferInsertModel<typeof {e}s>
```

mode=synced (cached from external provider):
```ts
import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

export const SyncStatus = {
  Pending: 'pending',
  Synced: 'synced',
  Error: 'error',
  Conflict: 'conflict',
} as const
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus]

export const {e}s = sqliteTable('{e}s', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  externalId: text('external_id').unique(),
  syncStatus: text('sync_status').notNull().default(SyncStatus.Pending).$type<SyncStatus>(),
  lastSynced: integer('last_synced', { mode: 'timestamp' }),
  {fields→drizzle},
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (t) => [
  uniqueIndex('idx_{e}s_external_id').on(t.externalId),
  index('idx_{e}s_sync_status').on(t.syncStatus),
  index('idx_{e}s_created').on(t.createdAt),
])

export type {E}Row = InferSelectModel<typeof {e}s>
export type {E}Insert = InferInsertModel<typeof {e}s>

export const {e}UpsertTarget = {e}s.externalId
```

## Migration →src/db/migrations/{yyyyMMddHHmm}_{e}.sql

mode=local:
```sql
CREATE TABLE IF NOT EXISTS {e}s (
  id TEXT PRIMARY KEY,
  {fields→SQL: text→TEXT, int→INTEGER, num→REAL, bool→INTEGER},
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_{e}s_created ON {e}s(created_at);
```

mode=synced:
```sql
CREATE TABLE IF NOT EXISTS {e}s (
  id TEXT PRIMARY KEY,
  external_id TEXT UNIQUE,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced INTEGER,
  {fields→SQL},
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_{e}s_external_id ON {e}s(external_id);
CREATE INDEX IF NOT EXISTS idx_{e}s_sync_status ON {e}s(sync_status);
CREATE INDEX IF NOT EXISTS idx_{e}s_created ON {e}s(created_at);
```

## Barrel export →src/db/schema/index.ts
Append to existing barrel (create if missing):
```ts
export { {e}s, type {E}Row, type {E}Insert } from './{e}'
```
If synced: also export `{e}UpsertTarget` and `SyncStatus`.

## Type alignment with @type skill
```
{E}Row        = DB shape (snake_case cols via drizzle mapping, includes id/timestamps/sync cols)
Normalized{E} = API/UI shape (camelCase, branded ID, no sync cols)
mapToRow(normalized) → {E}Insert   // used by @api source=both
mapFromRow(row) → Normalized{E}    // used by @api source=db GET handlers
```
These mappers live in the route file or a colocated `{e}.mappers.ts` if >10 lines.

## Soft delete pattern
Never hard-delete entities. Set `deletedAt` instead:
```ts
await db.update({e}s).set({ deletedAt: new Date() }).where(eq({e}s.id, id))
db.select().from({e}s).where(isNull({e}s.deletedAt))
```

## updatedAt pattern
D1 has no triggers. Set explicitly in every update/upsert:
```ts
.set({ ...changes, updatedAt: new Date() })
```

## Migration workflow
```bash
pnpm db:generate
```
Review SQL in `src/db/migrations/` before applying.
```bash
pnpm db:migrate
```
Production:
```bash
wrangler d1 migrations apply DB --remote
```
Bookmark before remote migrate:
```bash
wrangler d1 time-travel
```
`drizzle.config.ts` dialect `sqlite`, driver `d1-http`; schema `src/db/schema/index.ts`; out `src/db/migrations`.

>fk: fields ending _id → REFERENCES {parent}s(id), add index on fk col
>ix: created_at always, fk cols always, external_id unique (synced), sync_status (synced)
>IF NOT EXISTS on all CREATE TABLE and CREATE INDEX
>migration naming: {yyyyMMddHHmm}_{e}.sql (e.g. 202604061200_campaign.sql)
>mode=synced: always include externalId+syncStatus+lastSynced, export UpsertTarget
>mode=local: no sync cols, simpler schema
>soft delete: deletedAt integer timestamp on all entities, filter isNull(deletedAt) in reads
>updatedAt: set explicitly in .set(), no triggers in D1
>timestamps: integer mode timestamp, NEVER text ISO
>no db.transaction(): sequence queries; fetch external data first, then write
>DB column defaults and migration SQL use SQLite literals (exempt from domain-const rule)

$ARGUMENTS
