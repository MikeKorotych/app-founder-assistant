---
description: Generate TypeScript types — internal + external mapping — in src/types/
---
>in: $ARGUMENTS = domain + type descriptions
>parse: domain, entities[], external_source?
>out: →src/types/{domain}.ts →re-export barrel src/types/index.ts
>deps: typescript only

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


## Internal types (always)

```ts
export type {E^}Id = string & { readonly __brand: unique symbol }
export function {E}Id(s: string): {E^}Id { return s as {E^}Id }

export const {E^}Status = { Active: 'active', Paused: 'paused', Archived: 'archived' } as const
export type {E^}Status = typeof {E^}Status[keyof typeof {E^}Status]

export interface Normalized{E^} {
  id: {E^}Id
  {fields→camelCase ts types}
  status: {E^}Status
  createdAt: string
  updatedAt: string | null
}

export type Create{E^} = Omit<Normalized{E^}, 'id' | 'createdAt' | 'updatedAt'>
export type Update{E^} = Partial<Create{E^}>
```

## Drizzle boundary — normalized types vs. DB row types

`{E^}Row = InferSelectModel<typeof {e}Table>` is the DB row — lives in `src/db/schema/{e}.ts` or the owning service. `Normalized{E^}` is the app contract — lives here in `src/types/{domain}.ts`. Map between them in the service/mapper; never expose DB row types at route or integration boundaries.

```
{E^}Row (InferSelectModel)  →  mapper / service  →  Normalized{E^}
```

## External→Internal mapping types (when external_source exists)

```ts
export interface External{E^} {
  {fields as returned by the external API — preserve source naming (e.g. snake_case)}
}

// Mapper lives in src/integrations/{name}/mapper.ts. See /provider skill.
// toInternal: External{E^} → Normalized{E^}
// toExternal: Create{E^} → external write payload (if writes are supported)
```

External closed-set wire values (e.g. a provider's `status` field with known vocabulary) get a `PascalCase as const` object + derived type here — referenced by mappers, Sets, equality checks. Never `string` on `External*` shapes when the value set is closed.

## Query options (shared per provider)

```ts
export type {Domain^}QueryOptions = {
  limit?: number
  offset?: number
  fields?: readonly string[]
  sort?: string
  where?: Record<string, Record<string, string | number | (string | number)[]>>
}
```

## Barrel update (always)

After adding or renaming a type in `src/types/`, update `src/types/index.ts`:

```ts
export type { {E^}Id, {E^}Status, Normalized{E^}, Create{E^}, Update{E^} } from './{domain}.js'
```

ESM imports use `.js` extensions even for `.ts` source files (Workers + `tsc` ESM convention).

>rules:
  `interface` for objects, `type` for unions/intersections/mapped types/branded IDs
  no enums → `PascalCase as const` object + `keyof typeof` derived type
  no any → `unknown` at boundaries, narrow inside
  no class → interface + factory function
  branded types for all entity IDs crossing a module boundary
  `Normalized*` = internal canonical shape (camelCase, ISO UTC string dates, explicit nulls, branded IDs)
  `External*` = raw API response shape (preserve source naming, no branding)
  shared types → `src/types/`; integration-local types → `src/integrations/{name}/`
  `Normalized*` decoupled from Drizzle `InferSelectModel` — map in service/mapper, never at route/integration boundary
>every status/type/category field MUST have a const+keyof object — never bare `string`
>external closed-set wire values get a const+keyof in `src/types/` too — referenced by mappers, Sets, equality checks; never typed as bare `string` on `External*` shapes when the value set is closed
>component-local closed sets follow the same const+keyof rule but live next to the consuming module, not in `src/types/`
>re-export: update `src/types/index.ts` barrel when adding or renaming types
>cross-skill refs: `/provider` for integration mappers, `/test` for fixture tests, `/db` for schema changes

$ARGUMENTS
