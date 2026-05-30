---
description: Scaffold a feature provider (interface → client → mapper → config → errors) on src/integrations/ for Cloudflare Workers
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

> in: $ARGUMENTS = integration name + external API + entities
> parse: F:feature, API:external_source, entities[]
> product context: providers are **leaves** in the outbound stack. Domain types live in `src/types/` and `src/db/schema/`. Per-provider normalized types (`NormalizedStripeCharge`, `NormalizedGithubRepo`) are platform-shaped — they bridge external API specifics into domain types via mappers. Never leak platform fields into cross-cutting domain types. Services own the write path to Drizzle; providers own the read path from external APIs.
> out:
>   →src/integrations/{F}/{F}.provider.ts
>   →src/integrations/{F}/http-client.ts
>   →src/integrations/{F}/mapper.ts
>   →src/integrations/{F}/config.ts
>   →src/integrations/{F}/errors.ts
>   →src/integrations/{F}/utils.ts (optional, ≤5 fns)
> deps: src/outbound/ (OutboundHttpClient, withRetry, CircuitBreaker, OutboundError, safeNormalize)

Architecture: consumer → provider → http-client → external API → mapper → Normalized types

Shared infrastructure (consumed, not re-implemented): **`src/outbound/`** provides `OutboundHttpClient`, `withRetry`, `CircuitBreaker`, `OutboundError`, `safeNormalize`. Import from `"../../outbound/index.js"` — never re-implement these primitives inside an integration.

## 1. Provider →{F}.provider.ts

```ts
export type Normalized{E^} = {
  id: string;
  {fields→camelCase, dates as string, nulls explicit}
  createdAt: string;
  updatedAt: string | null;
};

export type {F^}QueryOptions = {
  limit?: number;
  cursor?: string;
  fields?: string[];
};

export interface I{F^}Provider {
  iterate{E^}s(opts?: {F^}QueryOptions): AsyncGenerator<Normalized{E^}>;
  get{E^}ById(id: string): Promise<Normalized{E^} | null>;
}
```

The provider class implements `I{F^}Provider`, delegates to client + mapper, and never calls the external API directly. Cursor pagination uses `async function*` generators — no `let cursor` accumulator.

## 2. HttpClient →http-client.ts

```ts
import { OutboundHttpClient } from "../../outbound/index.js";
import {
  DEFAULT_BREAKER,
  DEFAULT_RETRY,
  STRIPE_API_BASE_URL,
} from "./config.js";
import { mapStripeResponseError } from "./errors.js";
import type { RawChargeListResponse } from "./stripe.types.js";

export class StripeClient extends OutboundHttpClient {
  constructor(config: { secretKey: string; baseUrl?: string }) {
    super({
      baseUrl: config.baseUrl ?? STRIPE_API_BASE_URL,
      service: "stripe",
      authHeaderBuilder: () => `Bearer ${config.secretKey}`,
      retry: DEFAULT_RETRY,
      breaker: DEFAULT_BREAKER,
      errorMapper: mapStripeResponseError,
    });
  }

  fetchCharges(cursor?: string): Promise<RawChargeListResponse> {
    return this.get("/v1/charges", {
      query: cursor ? { starting_after: cursor } : undefined,
    });
  }
}
```

Transport only — no business logic, no normalization. The caller constructs `StripeClient` with `{ secretKey: c.env.STRIPE_SECRET_KEY }`. Config from `c.env.*` (typed `Bindings` in `src/env.ts`); never `process.env` or `ConfigService`.

## 3. Mapper →mapper.ts

```ts
import { safeNormalize } from "../../outbound/index.js";
import type { NormalizedCharge } from "./stripe.provider.js";
import type { RawCharge } from "./stripe.types.js";

export function normalizeCharge(raw: RawCharge): NormalizedCharge {
  return {
    id: String(raw.id),
    amount: raw.amount,
    currency: raw.currency,
    createdAt: new Date(raw.created * 1_000).toISOString(),
    updatedAt: null,
  };
}
```

Pure function. No fetches. No Drizzle imports. Dates → ISO UTC. `snake_case` → `camelCase`. Nulls explicit. Tested in isolation with `makeRawCharge(overrides)` factories.

Wrap every normalize call in the provider with `safeNormalize`:

```ts
const items = raw.data.map((r) =>
  safeNormalize(() => normalizeCharge(r), "stripe:iterateCharges")
);
```

## 4. Errors →errors.ts

Default: use `OutboundRateLimitError`, `OutboundAuthError`, `OutboundTransportError`, `OutboundMappingError` with `service: "{F}"`. Wire `errorMapper` to translate vendor-specific shapes; most integrations need no custom subclass.

```ts
import {
  OutboundAuthError,
  OutboundRateLimitError,
  type ErrorMapper,
} from "../../outbound/index.js";

export const mapStripeResponseError: ErrorMapper = (response, bodyText) => {
  if (response.status === 401) {
    return new OutboundAuthError({
      service: "stripe",
      context: "response-status",
      message: "Invalid API key",
    });
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    return new OutboundRateLimitError({
      service: "stripe",
      context: "response-status",
      retryAfterMs: retryAfter ? Number(retryAfter) * 1_000 : null,
    });
  }
  return null;
};
```

Add a vendor-specific subclass **only** when the vendor returns a stable extra field callers switch on (e.g. a numeric subcode). Extend the **specific** error class to preserve `instanceof OutboundRateLimitError` downstream — never extend `OutboundError` directly.

```ts
import { OutboundRateLimitError } from "../../outbound/index.js";

export class StripeRateLimitError extends OutboundRateLimitError {
  readonly stripeRequestId: string;

  constructor(args: {
    context: string;
    retryAfterMs: number | null;
    stripeRequestId: string;
    cause?: unknown;
  }) {
    super({
      service: "stripe",
      context: args.context,
      retryAfterMs: args.retryAfterMs,
      cause: args.cause,
    });
    this.stripeRequestId = args.stripeRequestId;
  }
}
```

## 5. Config →config.ts

```ts
export const STRIPE_API_BASE_URL = "https://api.stripe.com";

export const STRIPE_ENDPOINTS = {
  charges: "/v1/charges",
  charge: "/v1/charges/:id",
} as const;

export const DEFAULT_RETRY = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
} as const;

export const DEFAULT_BREAKER = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
} as const;

export const BATCH_SIZE = 50;
```

All constants named. No magic numbers in client, provider, or mapper code.

## 6. Utils →utils.ts (optional)

Pure helpers, ≤5 functions, ≤10 lines each. Web-standard APIs only — no Node built-ins. If utils grows beyond that, the logic belongs in the mapper or a domain service.

> rules:
>   provider delegates to client + mapper — never calls the API directly
>   client handles transport only (retry + breaker via OutboundHttpClient) — no business logic, no normalization
>   mapper handles normalization only — never fetches, never imports Drizzle
>   config: all constants extracted — no magic numbers in client/provider/mapper
>   config values (base URL, secrets) come from c.env.* (typed Bindings) — never process.env in request paths
>   every entity gets a normalize{E^}() mapper function
>   every normalize call in the provider is wrapped in safeNormalize
>   cursor pagination in provider via async function* generators — no let cursor accumulator
>   error boundary: OutboundError stays inside src/integrations/{F}/ — services re-throw as HTTPException or domain errors before reaching route handlers
>   external API contract strings (endpoints, field names, status codes) extracted to config.ts — tests keep literal string assertions to lock wire format
>   tests: makeRaw{E^}(overrides) factories; mapper tests use real mapper + raw fixtures; provider tests mock client, use real mapper
>   cross-skill refs: @type for branded IDs, @test for vitest patterns, @lib for shared pure utils, @name for naming decisions

$ARGUMENTS
