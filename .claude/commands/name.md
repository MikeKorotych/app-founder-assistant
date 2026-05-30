---
description: Audit a proposed name (function / type / file / module) for clarity, codebase collisions, and overload before committing to it
---

## Pre-flight rules (see ../../docs/stack.md)

- **No comments** — see [Comments policy](../../docs/stack.md#comments-policy). No `//`, `/* */`, JSDoc; only tooling pragmas.
- **No default exports** — see [No default exports](../../docs/stack.md#no-default-exports). One named export per module; `import type`; ESM only.
- **No enums — const + keyof** — see [No enums — const + keyof](../../docs/stack.md#no-enums--const--keyof).
- **Branded IDs** — see [Branded IDs](../../docs/stack.md#branded-ids).
- **No `any`** — see [No any](../../docs/stack.md#no-any).
- **Deterministic names** — see [Deterministic naming](../../docs/stack.md#deterministic-naming). kebab-case files, PascalCase types, camelCase vars, CONSTANT_CASE scalars.
- **Self-check before done** — see [Self-check](../../docs/stack.md#self-check-before-declaring-a-task-done). Run `pnpm check` + `pnpm typecheck`.

> in: $ARGUMENTS = the proposed name(s) + what they refer to (function / type / file / module / field / route handler)
> parse: candidates[]={name, role(function|type|file|module|field|route), context}
> out: a verdict per candidate (good / suboptimal / bad) with concrete reasoning, plus a recommendation
> deps: /type /db /provider /mw
> boundary: this skill produces analysis, not code. If the verdict is 'rename,' the rename itself is mechanical (same files, same pipeline — source → types → routes → services → skills).

Use this skill **before** writing the code, or **before** committing if a name is added inline. Cheaper to challenge a name in design than to refactor after callers exist.

## Audit pattern

For each candidate name, run through these checks in order. Stop at the first failure.

### 1. Vacuous-prefix check (instant fail)

Reject any name starting with `Base*`, `Abstract*`, `Default*`, `Common*`, `Generic*`, `Helper*`, `Util*`, `Manager*` (when the role is not actually 'manager'). These prefixes carry no information — they communicate 'this is the kind that has the prefix' without telling the reader what the abstraction actually does.

Equivalent for non-function names: `default`, `common`, `helpers`, `utils` as the only identifier word in a file or module name. Fine as a _suffix_ (`stripe.helpers.ts`) when scoped; bad as a _standalone_ name.

### 2. Collision check (grep the codebase)

```bash
# top-level declarations across src/
grep -rn "export (function|const|type|class) Name" src/

# Drizzle table schemas
grep -rn "\bName\b" src/db/schema/

# Hono route handlers
grep -rn "Name" src/routes/

# Middleware
grep -rn "Name" src/middleware/

# Types and branded IDs
grep -rn "\bName\b" src/types/

# Provider integrations
grep -rn "Name" src/integrations/
```

If the name is already taken by another function, type, Drizzle column, or Hono handler with a different meaning, that's drift. Renaming the existing thing is sometimes the right answer; usually the new name should adjust to avoid the clash.

### 3. Convention alignment check

Verify the proposed name matches the team's deterministic naming rules:

- **Filenames** — kebab-case: `user-session.ts`, `stripe-mapper.ts`.
- **Types / interfaces** — PascalCase: `UserSession`, `NormalizedEvent`.
- **Variables and functions** — camelCase, verb-first for functions: `resolveUserFromAuthHeader`, not `getUser`.
- **Booleans** — `is/has/should/can` prefix: `isExpired`, `hasAccess`.
- **Collections** — plural + qualifier: `pendingJobs`, `activeSubscriptions`.
- **Module-scope scalars** — CONSTANT_CASE: `MAX_RETRIES`, `BASE_DELAY_MS`.
- **Closed-set values** — `const + keyof typeof`, never `enum`. A `PascalCase as const` object with PascalCase keys. No inline `'a' | 'b'` unions.
- **Entity IDs** — branded: `type UserId = string & { readonly __brand: unique symbol }`. Any function taking an ID takes the branded type, not bare `string`.

### 4. Overload check (codebase + ecosystem)

A name 'overloads' when the same word is used in different roles with different meanings nearby. Examples relevant to this stack:

- `External*` as a **type prefix** (per `/type` skill — raw wire-format types like `ExternalStripeEvent`) vs as a **function prefix** for the HTTP layer (rejected for this reason — would mean two unrelated 'external' concepts).
- `Provider` as the high-level **integration-pattern interface** (per `/provider` skill — `StripeProvider implements IStripeProvider`) vs `Provider*` for the **HTTP transport layer** (rejected — would mean two unrelated 'Provider' concepts).

The audit: search for the candidate root word as both function prefix AND type prefix AND Drizzle field name. If it appears in 2+ roles already, the new use overloads. Pick another word.

### 5. Direction / domain trade-off

For abstraction names that are not tied to a specific domain entity, pick between two axes:

- **Direction words** (`Outbound`, `Inbound`, `Upstream`, `Downstream`) — describe _what the abstraction does_ relative to the system boundary. Strong fit for transport/network layers (e.g. `OutboundHttpClient` in `src/outbound/`).
- **Domain words** (`User`, `Session`, `Order`, `Tenant`) — describe _who the abstraction relates to_. Strong fit for business-logic types and Drizzle table names.

If both fit, prefer **direction** for transport layers and **domain** for business types and DB entities. If the abstraction is direction-agnostic AND domain-agnostic, you are probably naming the wrong thing — re-examine the abstraction itself.

### 6. Single-word check

Primitive names should be one word with a clear suffix (`OutboundHttpClient`, `CircuitBreaker`, `RetryConfig`). Multi-word root prefixes tend to indicate the abstraction is doing two things.

Anti-pattern: `OutboundCachedRetryingHttpClient`. Three behaviors in the name. Either split the abstraction or compose at the consumer.

### 7. Field-vs-type naming consistency

When a Drizzle table has a discriminator column (`service: text('service')`, `kind: text('kind')`), the column name should answer a different question than the table name. Table = WHAT, column = WHO/WHICH.

Good: `outboundErrors` table (= what kind of record) + `service` column (= which service) — different questions.

Bad: `vendorErrors` table + `vendor` column — table and column use the same word, semantic redundancy.

### 8. Read-it-aloud test

Pick the most likely call site sentence and read it. If it is clunky, the name fails.

- `app.get('/users/:id', resolveUserFromHeader)` — reads naturally ✓
- `app.get('/users/:id', baseUserHandler)` — 'base of what?' ✗
- `stripeClient extends OutboundHttpClient` — reads naturally ✓
- `stripeClient extends VendorClient` — reads OK; `vendor` is right for the SaaS case but stretches for free-tier / self-hosted

## Anti-patterns by example

| Anti-pattern | Why it is bad | Fix |
|---|---|---|
| `BaseHttpClient` | Vacuous 'Base' prefix; tells you nothing | Pick a word that describes purpose: `OutboundHttpClient` (direction) or `VendorHttpClient` (domain) |
| `AbstractEvaluationProcessor` | 'Abstract' + bureaucratic 'Processor' — two empty words | `EvaluationRunner` or `EvaluationOrchestrator` (closer to what it does) |
| `DefaultRetryConfig` | If there is only one, it is not 'default' — it is `RetryConfig`. If there are several, name the variant: `AggressiveRetry`, `CautiousRetry` | `RetryConfig` for the type, `DEFAULT_RETRY` for the const (acceptable as a CONST naming, not as a type) |
| `Manager` suffix | Vague — what does it manage? | Name by the verb: `TokenIssuer`, `CredentialStore`, `SessionRegistry` |
| `ServiceHttpClient` | 'Service' too generic — collides with the service-layer pattern in `src/services/` | Pick a more specific word: `OutboundHttpClient`, `ApiHttpClient`, `VendorHttpClient` |
| `ApiError` | Overloaded with HTTP `ApiError` conventions; conflicts with Hono's own error types | Prefix with what kind of API: `OutboundApiError`, `StripeApiError` |
| `UserEnum` or `enum Status` | `enum` is forbidden — use `const + keyof typeof` | `const UserStatus = { Active: 'Active', Inactive: 'Inactive' } as const; type UserStatus = keyof typeof UserStatus` |
| `userId: string` | Bare `string` for entity IDs — loses brand safety | `userId: UserId` (branded type from `src/types/`) |

## How to use this skill

When asked to add a new abstraction (`/provider`, `/api`, `/db`, `/mw`, `/lib`, `/type`, or any future skill), invoke `/name` first on the proposed root identifier. The skill produces:

1. **Per-candidate verdict** with reasoning (good / suboptimal / bad).
2. **Recommendation** with confidence level.
3. **Trade-off summary** if multiple candidates pass — present the choice rather than picking unilaterally.

After the verdict, the calling skill proceeds with the chosen name. If the verdict is 'rename' for an existing name, the rename pattern is mechanical: source files → `src/db/schema/` (Drizzle tables) → `src/routes/` (Hono handlers) → `src/services/` → `src/types/` → skills. See [../../docs/stack.md](../../docs/stack.md) for naming conventions that drive real renames in this codebase.

## What this skill does NOT do

- Does not pick names for domain-loaded business types (User, Session, Order) — those are decided by the product, not by abstraction-naming heuristics.
- Does not generate the rename PR — the rename itself is a separate execution step.
- Does not enforce style mechanically — it audits and advises; the self-check step (`pnpm check` + `pnpm typecheck`) catches mechanical violations.

$ARGUMENTS
