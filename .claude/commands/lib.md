---
description: Create a utility function (pure, single-responsibility, colocated by scope) for Cloudflare Workers
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


> in: $ARGUMENTS = function description + scope
> parse: name, scope(provider-internal|shared|worker-local)
> out:
> →src/integrations/{name}/{feature}.utils.ts (provider-internal, colocated with provider)
> →src/lib/{name}.ts (shared, used by ≥2 modules)
> →src/utils/{name}.ts (worker-local, single consumer)
> deps: depends on the function

## Scope rules

| Scope               | Path                                        | Use when                                                                                    |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `provider-internal` | `src/integrations/{name}/{feature}.utils.ts` | Used by one provider's client/mapper only. Pure helpers ≤10 lines/fn.                      |
| `shared`            | `src/lib/{name}.ts`                          | Used by ≥2 modules. Promote only when second consumer arrives — never speculatively. ≤30 lines/fn. |
| `worker-local`      | `src/utils/{name}.ts`                        | Single consumer inside one route/service/middleware. Colocated with its owner. ≤30 lines/fn. |

## Provider-internal utility (colocated extractor)

```ts
import { isNil } from "../../lib/is-nil.js";

export function extractValidationScore(raw: {
  score?: number | null;
  maxScore?: number | null;
}): number | null {
  const score = raw.score;
  const max = raw.maxScore;
  if (isNil(score) || isNil(max) || max === 0) return null;
  return Math.round((score / max) * 100);
}
```

## Shared utility — nil guard (used by ≥2 modules)

```ts
export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}
```

## Shared utility — time/number formatting (Workers-safe, no Node built-ins)

```ts
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / MINUTE_MS);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / HOUR_MS);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(diff / DAY_MS)}d ago`;
}

export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
```

> rules:
>   pure functions only (no side effects, no I/O, no logger calls inside the util)
>   single responsibility — one function, one job
>   provider-internal → `src/integrations/{name}/{feature}.utils.ts`, ≤10 lines/fn
>   shared → `src/lib/{name}.ts`, ≤30 lines/fn, ≥2 consumers; promote on 2nd consumer, never speculatively
>   worker-local → `src/utils/{name}.ts`, ≤30 lines/fn, single consumer
>   no `any`, no `unknown` leaks at return type
>   closed-set strings consumed/returned must come from a `PascalCase as const` object + keyof type (per `/type`), never bare string literals
>   Web-standard APIs only — `Date.now()`, `globalThis.crypto`, `URL`, `TextEncoder`; no `Buffer`/`path`/`node:*`
>   `@test` mandatory for `shared` utilities

$ARGUMENTS
