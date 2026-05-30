---
description: Generate Vitest tests with the factory pattern (Workers-aware via @cloudflare/vitest-pool-workers when bindings are touched)
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


> in: $ARGUMENTS = file path or symbol to test + optional layer hint
> parse: target_path, exports[], test_type(unit|integration|provider|route)
> out: `__tests__/{name}.test.ts` (colocated under `src/`)
> deps:
> pure tests → vitest
> binding-touching tests → vitest + @cloudflare/vitest-pool-workers (`defineWorkersConfig` in vitest.config.ts)

## Stack rules

- **One runner: vitest.** No Jest. All test files: `import { describe, it, expect, vi } from 'vitest'`.
- **Two vitest modes:**
  - **Plain vitest** (default pool) — pure functions, mappers, utilities that do **not** touch `c.env`, D1, or Workers bindings.
  - **`@cloudflare/vitest-pool-workers`** — route handlers and any code reading `c.env.*`, querying D1, or using Workers-specific globals. Configured via `defineWorkersConfig` in `vitest.config.ts`.
- **Test file location:** `src/__tests__/{name}.test.ts` — colocated with source. Distinguish pool by config, not filename.
- Run: `pnpm test` (plain vitest) or `pnpm test:workers` (worker-pool config) — check `package.json` scripts.

## Factory pattern (every entity gets one)

```ts
const DEFAULT_ISO = "2026-01-01T00:00:00.000Z"

export const make{E^} = (overrides: Partial<{E^}> = {}): {E^} => ({
  id: crypto.randomUUID(),
  createdAt: DEFAULT_ISO,
  updatedAt: DEFAULT_ISO,
  ...overrides,
})
```

Factories live alongside tests in `src/__tests__/`. Re-export from a barrel when ≥2 consumers share the same factory. Factories must be pure — no I/O, no `vi.fn()` inside the factory body.

## Example 1 — Pure mapper test via `safeNormalize`

```ts
import { describe, it, expect } from "vitest"
import { safeNormalize } from "../outbound/safe-normalize.js"
import { mapExternalItem } from "../integrations/items/mapper.js"

const DEFAULT_ISO = "2026-01-01T00:00:00.000Z"

const makeExternalItem = (overrides: Partial<ExternalItem> = {}): ExternalItem => ({
  id: crypto.randomUUID(),
  name: "Widget",
  createdAt: DEFAULT_ISO,
  ...overrides,
})

describe("mapExternalItem", () => {
  it("maps id and name from a well-formed external shape", () => {
    const raw = makeExternalItem({ id: "ext-1", name: "Widget" })
    const result = mapExternalItem(raw)
    expect(result?.id).toBe("ext-1")
    expect(result?.name).toBe("widget")
  })

  it("returns null for a shape that fails safeNormalize", () => {
    const result = mapExternalItem({ id: null, name: undefined } as never)
    expect(result).toBeNull()
  })

  it("trims and lowercases the name field", () => {
    const raw = makeExternalItem({ name: "  WIDGET  " })
    expect(mapExternalItem(raw)?.name).toBe("widget")
  })
})
```

## Example 2 — Outbound provider client injecting `fetchImpl` + `sleep` + `now`

Outbound clients extend `OutboundHttpClient` and accept test seams via constructor options. Mock `fetch` with `vi.fn()`; never call real network.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ItemClient } from "../integrations/items/http-client.js"

const HTTP_OK = 200
const HTTP_NOT_FOUND = 404
const HTTP_SERVICE_UNAVAILABLE = 503
const DEFAULT_ISO = "2026-01-01T00:00:00.000Z"

const makeExternalItem = (overrides: Partial<ExternalItem> = {}): ExternalItem => ({
  id: crypto.randomUUID(),
  name: "Widget",
  createdAt: DEFAULT_ISO,
  ...overrides,
})

describe("ItemClient", () => {
  const mockFetch = vi.fn()
  const mockSleep = vi.fn().mockResolvedValue(undefined)
  const mockNow = vi.fn(() => 0)

  beforeEach(() => {
    vi.resetAllMocks()
    mockNow.mockReturnValue(0)
  })

  const buildClient = () =>
    new ItemClient({
      baseUrl: "https://api.example.com",
      fetchImpl: mockFetch,
      sleep: mockSleep,
      now: mockNow,
    })

  it("returns mapped items on 200", async () => {
    const external = makeExternalItem({ id: "i-1" })
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ items: [external] }), { status: HTTP_OK }),
    )
    const client = buildClient()
    const result = await client.fetchItems()
    expect(result[0].id).toBe("i-1")
  })

  it("returns null on 404 without throwing", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: HTTP_NOT_FOUND }))
    const client = buildClient()
    await expect(client.fetchById("missing")).resolves.toBeNull()
  })

  it("retries on transient 503 and resolves on subsequent success", async () => {
    const external = makeExternalItem({ id: "i-2" })
    mockFetch
      .mockResolvedValueOnce(new Response("{}", { status: HTTP_SERVICE_UNAVAILABLE }))
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [external] }), { status: HTTP_OK }),
      )
    const client = buildClient()
    const result = await client.fetchItems()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result[0].id).toBe("i-2")
  })
})
```

## Example 3 — Hono route test via `app.request`

Use plain vitest for routes that do not read `c.env.*` or query D1. Use `@cloudflare/vitest-pool-workers` when bindings are exercised.

```ts
import { describe, it, expect, vi } from "vitest"
import { app } from "../index.js"

const DEFAULT_ISO = "2026-01-01T00:00:00.000Z"

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: crypto.randomUUID(),
  name: "Widget",
  createdAt: DEFAULT_ISO,
  ...overrides,
})

vi.mock("../services/item.service.js", () => ({
  listItems: vi.fn().mockResolvedValue([makeItem({ id: "item-1" })]),
}))

describe("GET /items", () => {
  it("returns 200 with an items array", async () => {
    const res = await app.request("/items", { method: "GET" })
    expect(res.status).toBe(200)
    const body = await res.json() as { items: unknown[] }
    expect(body.items).toHaveLength(1)
  })

  it("returns 404 when the service resolves to null", async () => {
    const { listItems } = await import("../services/item.service.js")
    vi.mocked(listItems).mockResolvedValueOnce(null)
    const res = await app.request("/items/missing", { method: "GET" })
    expect(res.status).toBe(404)
  })

  it("returns 400 when the request body fails zod validation", async () => {
    const res = await app.request("/items", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: { "Content-Type": "application/json" },
    })
    expect(res.status).toBe(400)
  })
})
```

> rules:
> test behavior not implementation
> 1 describe per export
> ≥3 tests: happy + edge + error
> make{E^}(overrides?: Partial<{E^}>): {E^} factories — ids via `crypto.randomUUID()`; colocated in `src/__tests__/`
> mock external boundaries only (fetch, outbound clients, Drizzle via vi.mock) — never mock internal logic
> async: always await, never .then chains
> naming: `returns {result} on {condition}` or `{verb}s {object} when {condition}`
> no snapshot tests
> no inline comments in test files
> plain vitest for pure units/mappers; @cloudflare/vitest-pool-workers only when `c.env`/D1/Workers globals are exercised
> cross-skill refs: branded ID types via /type; provider clients via /provider; shared utils via /lib
> verify: after generating tests, run `pnpm test` — generated tests must pass on first run

$ARGUMENTS
