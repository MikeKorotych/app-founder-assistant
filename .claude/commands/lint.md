---
description: Run + fix Biome lint, edit biome.json rules. Auto-routes on "lint / fix lint / biome check / lint error".
---

> in: $ARGUMENTS = mode [check|fix|edit-config]
> parse: mode:check|fix|edit-config
> out:
> →biome.json
> →src/**/*.ts
> deps: biome

## Pre-flight rules (see ../../docs/stack.md)

- **No comments** — see [Comments policy](../../docs/stack.md#comments-policy). No `//`, `/* */`, JSDoc; only tooling pragmas (`biome-ignore`).
- **No default exports** — see [No default exports](../../docs/stack.md#no-default-exports). One named export per module; `import type`; ESM only.
- **No enums — const + keyof** — see [No enums — const + keyof](../../docs/stack.md#no-enums--const--keyof).
- **No `any`** — see [No any](../../docs/stack.md#no-any).
- **Deterministic names** — see [Deterministic naming](../../docs/stack.md#deterministic-naming). kebab-case files, PascalCase types, camelCase vars, CONSTANT_CASE scalars.
- **Self-check before done** — see [Self-check](../../docs/stack.md#self-check-before-declaring-a-task-done). Run `pnpm check` + `pnpm typecheck`.

## Modes

- **check** (default): `pnpm check` (= `biome check .` — lint + format + import sort). Reports violations. No file mutations.
- **fix**: `pnpm check:fix` (= `biome check . --write`). Re-run `pnpm check` after to confirm zero residuals. A non-zero exit after `--write` means a violation requiring manual rename / refactor — not autofix-able (typical: `noDefaultExport`, `noExplicitAny`, naming convention, `noCommonJs`).
- **edit-config**: edit `biome.json` per $ARGUMENTS. Changes apply to all files in `files.includes`. Run mode=check after.

## Enforced rules (from `biome.json`)

| Rule | Level | What it enforces |
|---|---|---|
| `style.noDefaultExport` | error | Named exports only — see [No default exports](../../docs/stack.md#no-default-exports) |
| `style.useImportType` | error | `import type` for type-only imports — ESM, no value import side-effects |
| `style.noEnum` | error | No TS `enum` — use `const + keyof typeof` — see [No enums](../../docs/stack.md#no-enums--const--keyof) |
| `style.noCommonJs` | error | ESM only — no `require()` / `module.exports` |
| `suspicious.noExplicitAny` | error | No `any` — use `unknown` + narrowing — see [No any](../../docs/stack.md#no-any) |
| `correctness.noUnusedImports` | error | Dead imports removed |
| `correctness.noUndeclaredDependencies` | error | All imports must be declared in `package.json` |
| `security.noSecrets` | error | No hardcoded secrets or tokens |
| `suspicious.noConsole` | warn | No raw `console.*` — use `createLogger(scope)` from `src/utils/logger.ts` |
| `style.noNonNullAssertion` | warn | Avoid `!` — narrow explicitly; relaxed in `__tests__/**` |
| `style.useNamingConvention` | warn | kebab-case files, PascalCase types, camelCase vars, CONSTANT_CASE scalars — see [Deterministic naming](../../docs/stack.md#deterministic-naming) |
| `style.useFilenamingConvention` | warn | Filenames must be kebab-case |
| `correctness.noUnusedVariables` | warn | Dead bindings flagged |
| `nursery.noShadow` | warn | No variable shadowing |

## Ignores and overrides

- Files in scope: `files.includes` in `biome.json` (e.g. `src/**`). Unknown file types skipped (`ignoreUnknown: true`).
- `.gitignore` respected automatically (`vcs.useIgnoreFile: true`).
- `__tests__/**` — `noNonNullAssertion` and `noSecrets` relaxed (test fixtures need non-null assertions and dummy tokens).
- `vitest.config.ts` — `noDefaultExport` relaxed (Vitest requires a default export for config).

## Suppress a single line

Only when a genuine tooling constraint forces a violation:

```ts
// biome-ignore lint/style/noDefaultExport: vitest config requires default export
```

Never suppress `noDefaultExport`, `noExplicitAny`, `noEnum`, or `noCommonJs` in `src/` — those are load-bearing.

## Refactor-on-touch

When a touched file fails `pnpm check`, fix it in the same change:

- `noDefaultExport` → convert to named export; update all import sites.
- `noExplicitAny` → replace with `unknown`; narrow with type guards or `satisfies`.
- `noEnum` → replace with `const X = { ... } as const` + `type X = keyof typeof X`.
- `noCommonJs` → convert to ESM `import`/`export`; add `.js` extension to relative specifiers.
- `noConsole` → route through `createLogger(scope)` from `src/utils/logger.ts`.
- `useImportType` → add `type` keyword to import: `import type { Foo } from './foo.js'`.
- `useNamingConvention` / `useFilenamingConvention` → rename per [Deterministic naming](../../docs/stack.md#deterministic-naming).
- `noNonNullAssertion` → narrow with `if (!x) throw new Error(...)` or optional chaining.

## Out-of-scope

Format-only drift (indentation, quotes, trailing commas) → `pnpm format` (`biome format . --write`). Build / wrangler config → `wrangler deploy --dry-run`. Tests → `pnpm test`.

$ARGUMENTS
