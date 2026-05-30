---
description: Run + apply Biome formatting, edit biome.json. Auto-routes on "format / biome / fmt / format drift".
---

> in: $ARGUMENTS = mode [check|apply|edit-config]
> parse: mode:check|apply|edit-config
> out:
> →biome.json (root)
> deps: biome (devDependency, driven via root pnpm scripts)

## Pre-flight rules (see ../../docs/stack.md)

- **No comments** — see [Comments policy](../../docs/stack.md#comments-policy). No `//`, `/* */`, JSDoc; only tooling pragmas.
- **No default exports** — see [No default exports](../../docs/stack.md#no-default-exports). One named export per module; `import type`; ESM only.
- **No enums — const + keyof** — see [No enums — const + keyof](../../docs/stack.md#no-enums--const--keyof).
- **No `any`** — see [No any](../../docs/stack.md#no-any).
- **Deterministic names** — see [Deterministic naming](../../docs/stack.md#deterministic-naming). kebab-case files, PascalCase types, camelCase vars, CONSTANT_CASE scalars.
- **Self-check before done** — see [Self-check](../../docs/stack.md#self-check-before-declaring-a-task-done). Run `pnpm check` + `pnpm typecheck`.

## Modes

- **check** (default): `biome format .` (no `--write`). Non-zero exit on drift. Reports files that would change. No mutations.
- **apply**: `pnpm format` (= `biome format . --write`). Writes changes. Commit separately from logic changes.
- **edit-config**: edit root `biome.json` `formatter` or `javascript.formatter` sections per $ARGUMENTS.

## Config

Single root `biome.json`. Canonical formatter settings:

```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "all",
      "semicolons": "asNeeded"
    }
  },
  "files": {
    "includes": ["src/**", "*.ts", "*.json", "*.jsonc"]
  },
  "vcs": {
    "useIgnoreFile": true
  }
}
```

`vcs.useIgnoreFile: true` makes Biome respect `.gitignore`. Ensure `dist/`, `.wrangler/`, and `src/db/migrations/` are listed in `.gitignore` so they are excluded from formatting.

Do not add nested `biome.json` overrides under `src/` — a single root config is the only source of truth.

## Scope

This skill owns **format rules only** (`biome format`). Lint rules (`biome check`) are owned by `/lint`. Build / deploy config → `/build`.

## DO NOT

- Mix formatting changes with logic changes in the same commit — format-only diff first, then logic.
- Run `apply` on a dirty working tree without the user's explicit acknowledgment.
- Reference ESLint, Prettier, or any `@phasekit/*` tooling — this project uses Biome exclusively.

$ARGUMENTS
