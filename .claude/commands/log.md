---
description: Add structured logging to Worker/Hono code (edits existing files, never creates new ones)
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


> in: $ARGUMENTS = file path(s) or scope (route|job|sync|middleware|all)
> parse: targets[]=file paths | scope:route|job|sync|middleware|all
> out: edits to target files in src/ (no new files)
> deps: `src/utils/logger.ts` (exports `createLogger`); `errorMessage` from relative import in `src/outbound/` or `src/lib/`
> boundary: src/ only. Never edits generated migration files, wrangler.jsonc, or src/db/migrations/.

## Logger API

```ts
import { createLogger } from "../utils/logger";

const log = createLogger("{scope}");

log.info("message", { key: "value" });
log.warn("message", { key: "value" });
log.error("message", { key: "value" });
```

Output: `[{scope}] {LEVEL} {message} {json}`. Surfaced via `wrangler tail --format pretty`.

## Scope naming

| Layer | File pattern | Scope |
|---|---|---|
| routes | `src/routes/{e}.ts` | `{e}` |
| middleware | `src/middleware/{m}.ts` | `mw:{m}` |
| jobs / cron | `src/index.ts` scheduled handler | `job:{name}` |
| integrations | `src/integrations/{name}/` | `sync:{name}` |

Examples: `validateIdea`, `mw:auth`, `job:scoring`, `sync:anthropic`

## Log placement rules

### Level: error
- catch blocks that swallow or remap errors
- failed external calls (LLM, any integration)
- batch/pool failures summary when `failed.length > 0`
- unrecoverable state (circuit-open, revoked tokens)

### Level: warn
- degraded but non-fatal paths (retry exhausted but handled, fallback fired)
- skipped items (classifier rejected, record soft-deleted)
- best-effort operations that failed

### Level: info
- operation start/completion for long-running work (scoring runs, sync, cron)
- external events received (webhook ingest)
- state transitions (validation run status change)

### Never log
- happy-path CRUD (covered by `hono/logger` middleware — wire once in `src/index.ts`)
- raw request/response bodies
- secrets, tokens, API keys, PII, full LLM prompts or responses
- inside tight loops — log the batch summary after instead
- inside D1 query sequences that must be atomic — log after the last write

## Structured data patterns

```ts
import { errorMessage } from "../lib/error-message";

log.error("LLM call failed", { error: errorMessage(err) });
log.error("daily sync failed", { accounts: [...failed] });
log.warn("integration skipped", { reason: "inactive", integrationId });
log.info("scoring started", { runId, ideaId });
log.info("scoring completed", { runId, ideaId, durationMs, synced, failed: failed.length });
log.info("batch processed", { batchIndex, synced: result.synced });
```

Rules:
- **Errors**: `errorMessage(err)` — extracts `message`/`name`/`OutboundError.kind`; never pass a raw `Error` (JSON.stringify emits `{}`).
- **Sets**: spread into arrays (`[...set]`) before passing.
- **Durations**: `durationMs: Date.now() - startedAt`.
- **Counts**: named keys (`synced`, `failed`, `skipped`) — never a generic `count`.
- **Flat shape**: prefer flat keys; nested only for genuine sub-structures.

## Execution

1. Resolve targets: if scope provided, glob matching files in `src/`; if paths, use directly.
2. For each target file:
   a. Read the file; check if `createLogger` is already imported — skip import if present.
   b. Add `import { createLogger } from "../utils/logger";` (adjust relative depth).
   c. Add `const log = createLogger("{scope}");` after imports, using the scope table above.
   d. Replace any `console.log(...)` / `console.warn(...)` / `console.error(...)` used for structured output with `log.info` / `log.warn` / `log.error`.
   e. Replace template-string log calls with decomposed field form.
   f. Scan for log points matching placement rules; add new calls at catch blocks, batch summaries, state transitions, long-running operation start/completion.
3. Verify: no bare `console.*` structured-output calls remain in modified files; no raw `Error` objects as field values; no secrets or PII in any field.

> idempotency: if file already has `createLogger` and all log points are covered → skip
> never add log calls inside tight loops — log the batch summary after
> never log inside D1 query sequences — log after the last write
> NEVER log secrets, tokens, API keys, full LLM prompts/responses, full request bodies, or user-supplied free-text
> for long-running operations: log start + completion + counts
> cross-skill refs: `/type` for branded IDs, `/api` for route wiring, `/mw` for HTTP request-level logging middleware

$ARGUMENTS
