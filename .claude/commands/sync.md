---
description: Sync — data-sync orchestration (init|add-entity|status) + docs↔code drift audit (check|fix-code|fix-docs)
---
>role: sync architect + drift auditor. Two duties in one skill: (a) build/extend the data-sync engine backed by D1, (b) detect and repair drift between skills/docs and the codebase.
>in: $ARGUMENTS = mode + optional E:entity | target
>parse: mode:init|add-entity|status|check|fix-code|fix-docs E?:entity
>branch:
  data-sync modes (init | add-entity | status) → use **Architecture**, **Cost-Benefit**, **Data-Sync Modes**, **Data-Sync Rules**
  audit modes (check | fix-code | fix-docs) → use **Audit Architecture**, **Audit Modes**, **Audit Rules**
>invalid mode: print available modes and exit without side effects

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


---

## Architecture (data-sync)

```
External API
  ↓ (cursor-paginated, updated_since filter)
src/sync/drain-pages.ts
  ↓
src/sync/sync-engine.ts (orchestrator)
  ├── full sync: no updated_since, drain all pages
  ├── incremental sync: updated_since = last watermark - 60s overlap
  ├── conflict: server-wins + version fence
  └── retry: exponential backoff, 3 attempts, idempotency key
  ↓
src/db/schema/{sync-state,sync-jobs,sync-errors,webhook-events}.ts (4 tables)
  ├── sync_state: per-account per-entity watermark
  ├── sync_jobs: run history + idempotency
  ├── sync_errors: per-entity failure log
  └── webhook_events: dedup + audit
```

## Cost-Benefit Formula (data-sync)

Pattern: Incremental + Server-Wins + D1 Queue + Webhook Hybrid

Benefits >> Risks:
- B1: 90% API call reduction via updated_since (rate limit headroom)
- B2: Near-real-time via webhooks (UX)
- B3: Simple conflict model — external source wins, no CRDT complexity
- B4: Full observability (3-table model)
- B5: Resumable via cursor checkpoint
- B6: No new CF products (D1 only)
- B7: Idempotent re-runs

Risk mitigations:
- R1: updated_since misses → weekly full re-sync + 60s overlap on watermark
- R2: No durable execution → cursor checkpoints in sync_state.lastCursor
- R3: Webhook at-least-once → SHA256 dedup in webhook_events
- R4: Lost local edits → version fence (remoteUpdatedAt check before write)
- R5: D1 growth → 30-day retention prune in daily cron

---

## Data-Sync Modes

### mode=init (first time setup)

>idempotency: skip files that already exist

#### Step 1: DB schemas
→src/db/schema/sync-state.ts
→src/db/schema/sync-jobs.ts
→src/db/schema/sync-errors.ts
→src/db/schema/webhook-events.ts
→src/db/migrations/YYYYMMDDNNNN_sync_state.sql
→src/db/migrations/YYYYMMDDNNNN_sync_jobs.sql
→src/db/migrations/YYYYMMDDNNNN_sync_errors.sql
→src/db/migrations/YYYYMMDDNNNN_sync_events.sql
>append exports to src/db/schema/index.ts

#### Step 2: Sync types
→src/types/sync.ts
Types: SyncMode, SyncJobStatus, SyncEntityType, SyncStatusSummary
>const + keyof typeof pattern, no enums
>append exports to src/types/index.ts (if barrel exists)

#### Step 3: Sync engine
→src/sync/sync.config.ts (constants: BATCH_SIZE, CONCURRENCY, RETRY_CONFIG, timeouts as named consts)
→src/sync/sync-engine.ts (createEntitySync factory, runAccountSync orchestrator)
→src/sync/conflict-resolver.ts (server-wins + version fence)
→src/sync/webhook-processor.ts (process pending webhook_events → trigger incremental sync)
→src/sync/index.ts (barrel — named re-exports only)

#### Step 4: API routes
→src/routes/sync.ts (POST /sync/trigger/:accountId, POST /sync/full/:accountId)
→src/routes/webhooks.ts (GET+POST /webhooks — verify + HMAC + enqueue)
→src/routes/sync-status.ts (GET /sync/status/:accountId, GET /sync/jobs/:accountId)

#### Step 5: Cron handler
Edit src/index.ts — add `scheduled` export alongside `fetch`:
- daily cron: incremental sync all active entities + prune old jobs/errors (30-day retention)
- short cron: process webhook events + retry failed jobs
>cron job name literals live in src/constants/jobs.ts as a `JobName` const object (PascalCase keys, string values)

#### Step 6: Wiring
Edit src/env.ts — add WEBHOOK_VERIFY_TOKEN to Bindings + validateEnv schema
Edit src/index.ts — wire sync routes + scheduled handler
Edit wrangler.jsonc — add webhook verify token var

### mode=add-entity E:{entity}

>requires: mode=init already run (sync tables exist)
>deps: src/sync/sync-engine.ts, src/db/schema/sync-state.ts

Register entity sync handler:
1. Create →src/sync/entities/{E}.sync.ts
   - defines fetchPage (external API fields, path, params)
   - defines upsertBatch (D1 insert/update for entity table via getDb(c))
   - exports {E}Syncer conforming to EntitySyncConfig interface
2. Register in sync-engine entity registry (src/sync/sync-engine.ts)
3. Wire POST /sync/{E}s/:accountId route in src/routes/sync.ts

### mode=status

>deps: sync_state, sync_jobs tables

Read sync_state + sync_jobs for given account. Output:
- per entity type: last sync time, status, total synced, error count
- recent jobs: last 10 with duration + result
- pending webhook events count

## Data-Sync Rules

- all sync tables use `integer('col', { mode: 'timestamp' })` matching the Drizzle schema pattern (see [Backend rules](../../docs/stack.md#backend-rules-workershonodrizzle))
- server-wins conflict: external source is source of truth, local D1 is cache
- never hard-delete sync records — soft delete or prune by age
- idempotency key on sync_jobs: `{accountId}:{entityType}:{YYYY-MM-DD}` prevents duplicate daily syncs
- webhook handler returns 200 immediately, processes async via `waitUntil`
- HMAC-SHA256 verification on all webhook POSTs using WEBHOOK_APP_SECRET from `c.env`
- 60s overlap on incremental watermark to handle clock skew
- worker pool concurrency: use a semaphore/counter pattern; never spin raw Promise.all over unbounded arrays
- non-throwing error collection: failed items push to error array, continue processing, report at end
- cron job names via `JobName.*` from `src/constants/jobs.ts`
- no `db.transaction()` — D1 has no explicit BEGIN/COMMIT; sequence queries; fetch external data first, then write

---

## Audit Architecture (docs↔code drift)

```
.claude/commands/*.md           ─┐
CLAUDE.md                        │     scan
docs/**/*.{md,html}             ─┴──► extractors ──► refs[] ──► verifier ──► drifts[]
                                                                    │
                                                                    ▼
                                                     .claude/sync-manifest.json
                                                          ▲         │
                       fix-code / fix-docs ───────────────┘         │
                                                                    ▼
                                                        stdout summary + exit code
```

**Extractors** pull references from source docs in these forms:
- `→path/to/file` — skill output target (DSL convention)
- `>out path` / `>append exports to path` — output directives
- `@skill-name` — skill invocation (must match `.claude/commands/{skill}.md`)
- `` `path/ext` `` — inline-code path literals (must contain `/` and a recognizable ext or dir shape)
- `[label](path)` — markdown links to local files (non-http)
- `/command` inside CLAUDE.md **Auto-Routing** / **Skill Ownership** / **Agent Protocol** — must match a skill file
- `src/{name}` / `docs/{name}` / `.claude/{name}` inline spans anywhere in docs

**Extractor exclusions** (must not be treated as drift):
- **npm-scope imports** — `@hono/...`, `@cloudflare/...`, `@anthropic-ai/...`, `@hahaton/...` are package aliases, never filesystem refs. Recognize any `@`-prefixed token followed by `/` as a package scope and skip
- **TypeScript/JS pragmas** — `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `@deprecated`, `@throws`, `@param`, `@returns`, `@internal`, `@public`, `@private`, `@override`, `@vite-ignore`, `@biome-ignore`
- **CSS at-rules** — `@layer`, `@apply`, `@import`, `@theme`, `@keyframes`, `@custom-variant`, `@plugin`, `@media`, `@supports`, `@tailwindcss`, `@container-queries`, `@font-face` are not skills
- **English plurals / placeholders** — `@skills` (plural noun in prose), `@skill` / `@skill-name` / `@skill1..N` (template placeholders) are not skills
- **Strikethrough content** — text wrapped in `~~...~~` is intentionally-deferred; refs inside are not drift; strip before extraction
- **Fenced JSON/JSONC blocks** — refs inside ` ```json ` or ` ```jsonc ` blocks are illustrative
- **`<example>...</example>` blocks** — refs inside this skill-doc convention are illustrative
- **Template placeholders** — refs containing `{` or `}` (e.g. `{E}`, `{name}`) are template patterns; detect BEFORE decoration stripping so `{E}/types.ts` isn't mistaken for `E}/types.ts`
- **Gitignored env files** — paths matching `*.env*`, `.dev.vars`, `.dev.vars.*` are intentionally absent; skip
- **Slash-command references** — `/<skill-name>` where the name matches an existing skill file is an invocation, not a filesystem path

**Reference normalization** (apply in this order before resolution):
1. Skip if the raw form matches a template placeholder (`{`/`}` present)
2. Strip surrounding decoration: backticks, commas, semicolons, brackets, angle brackets, single/double quotes, spaces, trailing dot. Do not strip braces, parens, or leading dots
3. Trim leading `./` (the two-character prefix only)
4. If ref starts with `..`, resolve relative to the source file's directory before existence check

**Reference resolution** (a ref resolves if any of these holds):
1. Direct: `REPO/ref` exists as a file or directory
2. With extension fallback: `REPO/ref{.ts,.js,.mjs,.cjs,.json,.md,.sql,.jsonc,.html,.css}` exists
3. As a directory index: `REPO/ref/index{ext}` exists
4. Relative-root fallback for bare `routes/...`, `services/...`, `db/...`, `integrations/...`, `outbound/...`, `middleware/...`, `lib/...`, `constants/...`, `types/...`, `utils/...` heads: try `src/` prefix
5. Doc-relative `*.html` or `*.md` with no slash: try `REPO/docs/{ref}`

**Verifier** classifies each ref:
- `existing` — path resolves (per above)
- `output-target` — path doesn't exist but parent dir does AND ref came from a `→` or `>out` directive (legit future output)
- `missing-path` — ref is non-output and path doesn't resolve
- `missing-parent` — `→` output ref whose parent dir doesn't exist (skill would fail on first run)
- `missing-skill` — `@skill` or `/command` has no matching `.claude/commands/{name}.md`
- `ownership-conflict` — two skills declare ownership of overlapping paths in CLAUDE.md **Skill Ownership** section
- `orphan-skill` — `.claude/commands/{name}.md` exists but is unreferenced in CLAUDE.md auto-routing AND ownership (including pipeline/orchestration subsections). Skill-name detection must accept 1+ char names (`@q`, `@db`)
- `stack-mismatch` — a package cited in `docs/stack.md`'s stack table is absent from `package.json`, or a binding listed in the table is absent from `wrangler.jsonc`

## Audit Modes

### mode=check

>side-effects: writes `.claude/sync-manifest.json` only
>exits 0 if no drift, 1 if drift found (so CI can gate on it)

**Implementation**: a runnable reference implementation may live at `.claude/sync-check.py` (Python 3, no deps). Run via `python3 .claude/sync-check.py` — completes in <1s, writes the manifest, prints the summary. Agents may re-implement inline using this skill's spec; the script is the canonical example.

Steps:
1. Enumerate sources — glob `.claude/commands/*.md`, read `CLAUDE.md`, `docs/**/*.{md,html}`
2. For each source, run all extractors; attach `{source, line, kind, raw}` to every ref
3. Verify each ref against the filesystem (glob/stat) — never mutate
4. Additionally, cross-check `docs/stack.md` stack table entries against `package.json` `dependencies`/`devDependencies` and `wrangler.jsonc` `[[d1_databases]]`/`[[kv_namespaces]]`/`[[r2_buckets]]` bindings
5. Collect drifts in a flat array; sort by `source` then `line`
6. Write →`.claude/sync-manifest.json`:
```json
{
  "version": "1",
  "generatedAt": "<ISO8601>",
  "repoRoot": "<abs path>",
  "sourceCount": { "skills": 0, "docs": 0 },
  "refCount": 0,
  "driftCount": 0,
  "drifts": [
    {
      "source": ".claude/commands/foo.md",
      "line": 42,
      "kind": "missing-path",
      "ref": "src/bar/x.ts",
      "suggestedFix": "fix-code",
      "note": "<short human-readable reason>"
    }
  ]
}
```
7. Print a compact summary:
```
Sync check: {skillCount} skills, {docCount} docs, {refCount} refs, {driftCount} drifts
  [kind] {source}:{line} → {ref}    (fix: {suggestedFix})
  ...
Run /sync fix-code or /sync fix-docs to resolve, or commit the manifest if drift is intentional.
```

**Suggested-fix heuristic**:
- `missing-parent` on a `→` output target → `fix-code` (skill expects to create file under a dir that must exist)
- `missing-path` on a doc narrative reference → `fix-docs` (doc is stale)
- `missing-skill` in CLAUDE.md auto-routing → `fix-docs` (route points to a skill that doesn't exist)
- `ownership-conflict` → `fix-docs` (resolve by editing CLAUDE.md ownership section)
- `orphan-skill` → `fix-docs` (wire the skill into CLAUDE.md or delete it — prompt before deletion)
- `stack-mismatch` → `fix-docs` (update the stack table to match `package.json`/`wrangler.jsonc`)

### mode=fix-code

>requires: `.claude/sync-manifest.json` exists (run `/sync check` first)
>action: reconcile `suggestedFix:"fix-code"` drifts by creating missing parent directories only
>never generates stub source files — empty dirs are tracked via `.gitkeep` only when the skill that owns the path would otherwise fail

Steps:
1. Read manifest
2. Filter drifts where `suggestedFix === "fix-code"`
3. For each, create the missing parent dir (`mkdir -p`); if the owning skill enumerates required stub files, list them for the user but do NOT write them
4. Re-run `check` to regenerate manifest; print the reduced drift list

### mode=fix-docs

>requires: `.claude/sync-manifest.json` exists
>action: propose edits to docs that resolve `suggestedFix:"fix-docs"` drifts; apply after user confirmation for each edit

Steps:
1. Read manifest
2. Group drifts by `source` file
3. For each source, propose the minimal edit:
   - `missing-path` in narrative prose → update the path to the current location OR remove the sentence
   - `missing-skill` in auto-routing → remove the routing line OR point it at an existing skill
   - `ownership-conflict` → collapse duplicate ownership or split the path
   - `orphan-skill` → add a one-line auto-routing entry OR prompt to delete the orphan
   - `stack-mismatch` → update the stack table row to match `package.json`/`wrangler.jsonc`
4. Apply via Edit tool (one per drift); after each, re-run verifier on that source only
5. After all edits, re-run full `check` to regenerate manifest

## Audit Rules

- `.claude/sync-manifest.json` is the single source of truth for the latest audit result
- `check` is pure-read; `fix-code` is dir-only; `fix-docs` is edit-with-confirm — never combine modes in one invocation
- an `@skill` ref of the form `@provider` matches `.claude/commands/provider.md`; a `/command` ref matches the same
- ownership-conflict detection reads the **Skill Ownership** bullet list in CLAUDE.md; two bullets whose owned paths overlap (prefix match on normalized path) conflict
- extractor strips backticks, trims whitespace, normalizes `./` prefix; paths starting with `http`, `https`, `#`, `mailto:` are skipped
- refs inside fenced code blocks (```) are still extracted — they often name real files — but refs inside `<example>` tags are skipped
- a skill file's own `→` output targets are **expected-missing** on first run; they produce `output-target` refs, never `missing-path`. Only the **parent dir** existence is enforced
- when in doubt between `missing-path` and `output-target`, prefer `output-target` — false-positive missing is worse than silent missing
- never write source code in audit modes; the skill audits structure, it does not generate application code
- `check` must finish in under ~3s for the current repo — parallelize source reads, verify via glob batch, not Read per file
- `wrangler.jsonc` binding names are the authoritative source for `c.env.*` references; `docs/stack.md` rows must match them exactly

$ARGUMENTS
