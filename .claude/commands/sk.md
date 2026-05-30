---
description: Build a new agent skill or pipeline (scaffold a .claude/commands/*.md file)
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


> role: skill-factory. You create `.claude/commands/*.md` files.
> Read [docs/stack.md](../../docs/stack.md) — anchor doc for all stack conventions, repo layout, and cross-references.

## Notation legend

| Token | Meaning |
|---|---|
| `$ARGUMENTS` | Raw user input forwarded through the skill chain |
| `> directive` | Machine-readable contract line (in:, parse:, out:, deps:, rules:, test:) |
| `@skill` | Invokes a sibling skill by name (must exist in `.claude/commands/`) |
| `→path` | Concrete output file path anchored at repo root |
| `{X^}` | Template var rendered as PascalCase (e.g. `{entity^}` → `UserSession`) |
| `{X}` | Template var rendered as camelCase (e.g. `{entity}` → `userSession`) |

Anchor doc: [docs/stack.md](../../docs/stack.md). Run `/sync` after adding a new skill.

> in: $ARGUMENTS = {name, type, purpose, inputs, outputs}
> parse: name E:string T:≤8-chars-kebab, type E:'atomic'|'pipeline', purpose E:string, inputs E:string, outputs E:string[]
> out: →.claude/commands/{name}.md
> deps: none (meta-skill, emits Markdown only)

## Repo layout reminder (single package — not a monorepo)

All output paths are anchored at `src/` (no `apps/*` / `packages/*`):

| Concern | Path | Owning skill |
|---|---|---|
| Hono routes | `src/routes/{e}.ts` | `/api` |
| Middleware | `src/middleware/{m}.ts` | `/mw` |
| Services | `src/services/{e}.service.ts` | `/api` |
| Drizzle schema | `src/db/schema/{e}.ts` | `/db` |
| DB client | `src/db/client.ts` | — |
| Provider | `src/integrations/{name}/` | `/provider` |
| Outbound layer | `src/outbound/` | — |
| Types | `src/types/{domain}.ts` | `/type` |
| Shared lib | `src/lib/{name}.ts` | `/lib` |
| Logger | `src/utils/logger.ts` | `/log` |
| Error/HTTP consts | `src/constants/{errors,http}.ts` | — |
| Tests | `__tests__/{name}.test.ts` | `/test` |

## Generated skill shape

Emit →.claude/commands/{name}.md with exactly this structure:

```
---
description: ≤10 words, action-first, auto-routing-friendly
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


> in: $ARGUMENTS = {what user provides}
> parse: {extracted variables — E: T: notation}
> out:
> →src/{path-anchored-to-repo-layout}
> deps: {imports / packages needed by generated code}

{pattern block — actual code template or structure the skill emits}

- Use `>directives` for rules
- Use @skill refs for composition (must match an existing `.claude/commands/{skill}.md`)
- Use →path for concrete output targets
- Template vars: {name}, {name^}, {fields}, {resource}, etc.

> rules:
> {skill-specific invariants — one per line}

$ARGUMENTS
```

## Rules for generated skills

- atomic: ≤80 lines body. pipeline: ≤120 lines. design/reference: unlimited but compress.
- No narrative prose, no inline code comments in templated output, no explanations.
- Every code-emitting skill MUST carry the full Pre-flight block above; links go to `../../docs/stack.md#<anchor>`.
- Use notation from this file only (`$ARGUMENTS`, `>`, `@skill`, `→`, `{X^}`, `{X}`).
- End with `$ARGUMENTS` so input passes through to the next step.
- atomic: single output concern, single `>out` target (or a small colocated cluster).
- pipeline: prefix name with `p-`; list steps numbered; each step is an @skill invocation; pass context forward with →.
- Always include `>out` with concrete paths anchored at `src/`, `docs/`, or `.claude/`.
- Always include `>parse` showing what is extracted from `$ARGUMENTS`.
- If a similar skill exists in `.claude/commands/`, read it first; reuse patterns and naming conventions.
- Include `>test` directive when the output is testable code.
- Cross-skill refs: "run `/sync` after adding this skill to keep docs↔code aligned".

## Description quality guide

The `description:` line drives auto-routing — sibling agents read it to pick a skill.

| Good | Bad |
|---|---|
| `Scaffold a Hono route handler + service + Drizzle query` | `Create a route` |
| `Create a utility function (pure, colocated by scope)` | `Utility helper` |
| `Add a Drizzle migration and update schema.ts` | `Database stuff` |
| `Build a new agent skill or pipeline (scaffold a .claude/commands/*.md file)` | `Skill builder` |

## After writing

1. Confirm file created; show `/name` usage example with a concrete `$ARGUMENTS` string.
2. Run `/sync` so docs↔code stays aligned and the new skill appears in routing indexes.

$ARGUMENTS
