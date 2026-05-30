---
description: Create a Hono API route handler (zValidator + service + wiring) for Cloudflare Workers
---
>in: $ARGUMENTS = entity + actions[GET|POST|PATCH|DELETE] + source(db|provider|both)
>parse: E:entity actions[]=GET|POST|PATCH|DELETE source:db|provider|both
>out: →src/routes/{e}.ts (+ →src/middleware/{e}.ts if source=provider|both)
>deps: hono, @hono/zod-validator, drizzle-orm, src/types/{domain}.ts, src/db/client.ts, src/utils/error-response.ts, src/utils/logger.ts

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


## Route →src/routes/{e}.ts

```ts
import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { desc, eq, isNull, sql } from "drizzle-orm"
import { {e}s } from "../db/schema/{e}.js"
import { create{E^}Schema, update{E^}Schema } from "../types/{domain}.js"
import { ErrorCode } from "../constants/errors.js"
import { RouteParam } from "../constants/http.js"
import type { BaseEnv } from "../types/env.js"
import { getDb } from "../db/client.js"
import { errorResponse } from "../utils/error-response.js"
import { createLogger } from "../utils/logger.js"
import { parsePagination } from "../utils/pagination.js"

const log = createLogger("{e}")
const app = new Hono<BaseEnv>()

app.onError((err, c) => {
  if (err instanceof {E^}ApiError) return errorResponse(c, err.status ?? 500, err.code)
  log.error(`${c.req.method} ${c.req.path} unhandled`, { error: err.message })
  return errorResponse(c, 500, ErrorCode.InternalError)
})
```

## source=db (direct D1)
Routes (in order): paginated list (`desc(createdAt)` default, filter `isNull(deletedAt)`), get-by-id, create, partial update, delete. Generated code carries no narrative comments — endpoint intent is evident from the verb + path.
```ts
app.get("/", async (c) => {
  const db = getDb(c)
  const { limit, offset } = parsePagination(c)
  const [data, [{ total }]] = await Promise.all([
    db.select().from({e}s).where(isNull({e}s.deletedAt)).limit(limit).offset(offset).orderBy(desc({e}s.createdAt)),
    db.select({ total: sql<number>`count(*)` }).from({e}s).where(isNull({e}s.deletedAt)),
  ])
  return c.json({ data, total, limit, offset })
})

app.get("/:id", async (c) => {
  const db = getDb(c)
  const [row] = await db.select().from({e}s).where(eq({e}s.id, c.req.param(RouteParam.Id)))
  if (!row) return errorResponse(c, 404, ErrorCode.NotFound)
  return c.json({ data: row })
})

app.post("/", zValidator("json", create{E^}Schema), async (c) => {
  const db = getDb(c)
  const input = c.req.valid("json")
  const [row] = await db.insert({e}s).values(input).returning()
  return c.json({ data: row }, 201)
})

app.patch("/:id", zValidator("json", update{E^}Schema), async (c) => {
  const db = getDb(c)
  const input = c.req.valid("json")
  const [row] = await db.update({e}s)
    .set({ ...input, updatedAt: new Date() })
    .where(eq({e}s.id, c.req.param(RouteParam.Id))).returning()
  if (!row) return errorResponse(c, 404, ErrorCode.NotFound)
  return c.json({ data: row })
})

app.delete("/:id", async (c) => {
  const db = getDb(c)
  const [row] = await db.delete({e}s).where(eq({e}s.id, c.req.param(RouteParam.Id))).returning()
  if (!row) return errorResponse(c, 404, ErrorCode.NotFound)
  return c.body(null, 204)
})
```

## source=provider (delegates to provider, no local DB)
```ts
app.get("/", async (c) => {
  const data = await c.var.{e}Provider.getAll(FIELDS)
  return c.json({ data })
})

app.get("/:id", async (c) => {
  const row = await c.var.{e}Provider.getById(c.req.param(RouteParam.Id), FIELDS)
  if (!row) return errorResponse(c, 404, ErrorCode.NotFound)
  return c.json({ data: row })
})

app.post("/", zValidator("json", create{E^}Schema), async (c) => {
  const input = c.req.valid("json")
  const data = await c.var.{e}Provider.create(input)
  return c.json({ data }, 201)
})

app.patch("/:id", zValidator("json", update{E^}Schema), async (c) => {
  const input = c.req.valid("json")
  const data = await c.var.{e}Provider.update(c.req.param(RouteParam.Id), input)
  return c.json({ data })
})

app.delete("/:id", async (c) => {
  await c.var.{e}Provider.delete(c.req.param(RouteParam.Id))
  return c.body(null, 204)
})
```

## source=both (proxy: provider is source of truth, DB is cache)
Order: GET reads cache; mutations hit provider first then upsert/delete from cache; POST `/sync` drains the provider in batches. Cache-write rows always set `syncStatus: EntitySyncStatus.Synced` + a fresh `lastSynced`.
```ts
app.get("/", async (c) => {
  const db = getDb(c)
  const { limit, offset } = parsePagination(c)
  const [data, [{ total }]] = await Promise.all([
    db.select().from({e}s).limit(limit).offset(offset).orderBy(desc({e}s.createdAt)),
    db.select({ total: sql<number>`count(*)` }).from({e}s),
  ])
  return c.json({ data, total, limit, offset })
})

app.post("/", zValidator("json", create{E^}Schema), async (c) => {
  const input = c.req.valid("json")
  const result = await c.var.{e}Provider.create(input)
  const db = getDb(c)
  await db.insert({e}s).values({ ...mapToRow(result), syncStatus: EntitySyncStatus.Synced, lastSynced: new Date().toISOString() })
    .onConflictDoUpdate({ target: {e}s.metaId, set: { ...mapToRow(result), syncStatus: EntitySyncStatus.Synced, lastSynced: new Date().toISOString() } })
  return c.json({ data: result }, 201)
})

app.patch("/:id", zValidator("json", update{E^}Schema), async (c) => {
  const input = c.req.valid("json")
  const db = getDb(c)
  const [local] = await db.select().from({e}s).where(eq({e}s.id, c.req.param(RouteParam.Id)))
  if (!local?.metaId) return errorResponse(c, 404, ErrorCode.NotFound)
  const result = await c.var.{e}Provider.update(local.metaId, input)
  await db.update({e}s).set({ ...mapToRow(result), syncStatus: EntitySyncStatus.Synced, lastSynced: new Date().toISOString() })
    .where(eq({e}s.id, c.req.param(RouteParam.Id)))
  return c.json({ data: result })
})

app.delete("/:id", async (c) => {
  const db = getDb(c)
  const [local] = await db.select().from({e}s).where(eq({e}s.id, c.req.param(RouteParam.Id)))
  if (!local?.metaId) return errorResponse(c, 404, ErrorCode.NotFound)
  await c.var.{e}Provider.delete(local.metaId)
  await db.delete({e}s).where(eq({e}s.id, c.req.param(RouteParam.Id)))
  return c.body(null, 204)
})

app.post("/sync", async (c) => {
  const remote = await c.var.{e}Provider.getAll(FIELDS)
  const db = getDb(c)
  const failed = new Set<string>()
  const now = new Date().toISOString()
  const BATCH_SIZE = 50
  for (let i = 0; i < remote.length; i += BATCH_SIZE) {
    const chunk = remote.slice(i, i + BATCH_SIZE)
    await Promise.all(chunk.map(async (item) => {
      try {
        await db.insert({e}s).values({ ...mapToRow(item), syncStatus: EntitySyncStatus.Synced, lastSynced: now })
          .onConflictDoUpdate({ target: {e}s.metaId, set: { ...mapToRow(item), syncStatus: EntitySyncStatus.Synced, lastSynced: now } })
      } catch { failed.add(item.id) }
    }))
  }
  if (failed.size) log.warn("sync had failures", { failed: [...failed] })
  log.info("sync completed", { synced: remote.length - failed.size, failed: failed.size })
  return c.json({ synced: remote.length - failed.size, failed: [...failed] })
})
```

## mapToRow helper (source=both)
```ts
function mapToRow(normalized: Normalized{E^}): {E^}Insert {
  return { metaId: normalized.id, syncStatus: EntitySyncStatus.Synced }
}
```

```ts
export { app as {E^}Routes }
```

## Provider middleware →src/middleware/{e}.ts
```ts
import { createMiddleware } from "hono/factory"
import { {E^}Provider } from "../integrations/{e}/{e}.provider.js"
import type { BaseEnv } from "../types/env.js"

export const {e}ProviderMiddleware = createMiddleware<BaseEnv>(async (c, next) => {
  c.set("{e}Provider", new {E^}Provider(c.env))
  await next()
})
```
Wire: `app.use("/{e}s/*", {e}ProviderMiddleware)` in `src/index.ts`

## Response envelope
All endpoints follow:
- Success list: `{ data: T[], total: number, limit: number, offset: number }`
- Success single: `{ data: T }`
- Created: `{ data: T }` + 201
- Deleted: empty body + 204
- Error: `{ error: ErrorCode }` + HTTP status
- Sync: `{ synced: number, failed: string[] }`

>register: src/index.ts: `app.route("/{e}s", {E^}Routes)`
>PATCH not PUT for partial updates
>GET list: parallel count + data query, `desc({table}.createdAt)` default, filter `isNull(deletedAt)`, cap limit at 100
>DELETE: verify exists before 204 (return 404 if missing)
>source=both sync: batch upsert in chunks of BATCH_SIZE=50, collect failures
>provider errors: caught by app.onError, mapped to HTTP status via ErrorCode
>db instantiation: `getDb(c)` from `src/db/client.ts` — never inline `drizzle()` in handlers
>named sub-routes (e.g. POST /sync) appear BEFORE `/:id` — Hono matches top-to-bottom

$ARGUMENTS
