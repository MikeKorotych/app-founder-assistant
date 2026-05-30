---
description: Create a Hono middleware — composable cross-cutting concern for Cloudflare Workers
---
>in: $ARGUMENTS = M:type [options]
>parse: M:cors|logging|rate-limit|secure-headers|timing|error|guard|inject|internal-auth
>out: →src/middleware/{m}.ts
>deps: hono/factory(createMiddleware), hono/http-exception(HTTPException), hono/cors, hono/secure-headers, hono/timing, hono/bearer-auth, hono/combine(some,every,except), ./env(Bindings)
>boundary: @mw=cross-cutting. @auth=session.ts+meta-auth.ts. @api=per-entity provider mw.

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


## Base
`createMiddleware<{ Bindings: Bindings; Variables: {injected} }>`. Config from `c.env` inside body (CF Workers — no module-level env). Single named export. Each file imports only what it needs from >deps.

## M=cors →src/middleware/cors.ts
```ts
export const corsMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  return cors({
    origin: (origin) => {
      if (c.env.APP_ENV === "development") return origin;
      return origin.endsWith(".hahaton.app") ? origin : "https://hahaton.app";
    },
    credentials: true,
    maxAge: 86400,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Connection-Id"],
  })(c, next);
});
```

## M=logging →src/middleware/request-logger.ts (exists)
>already implemented. Uses `createLogger("http")` from `../utils/logger`.
>auto-selects level by response status: 5xx→error, 4xx→warn, 2xx/3xx→info.
>output: structured JSON `{"ts":…,"level":"info","service":"api","scope":"http","msg":"METHOD /path STATUS","ms":N}`
>skip: do not recreate. For module-level logging in routes/jobs/sync, use @log skill instead.

## M=rate-limit →src/middleware/rate-limit.ts
Factory. In-memory fixed-window via `RateLimiter` class from `../utils/rate-limiter`. Key = IP + routeKey. Config per route via `RATE_LIMIT_MAP` in `../constants/rate-limit`.
```ts
import { createMiddleware } from "hono/factory";
import { ErrorCode, InternalError } from "../constants/errors.js";
import { RequestHeader } from "../constants/http.js";
import { RATE_LIMIT_MAP } from "../constants/rate-limit.js";
import type { BaseEnv } from "../types/base.js";
import { errorResponse } from "../utils/error-response.js";
import { RateLimiter } from "../utils/rate-limiter.js";

const limiter = new RateLimiter();

export function rateLimit(routeKey: string) {
  const rule = RATE_LIMIT_MAP[routeKey];
  if (!rule) throw new Error(`${InternalError.missingRateLimitConfig}: ${routeKey}`);

  return createMiddleware<BaseEnv>(async (c, next) => {
    const ip =
      c.req.header(RequestHeader.CfConnectingIp) ??
      c.req.header(RequestHeader.XForwardedFor) ??
      "unknown";
    const key = `${ip}:${routeKey}`;
    const result = limiter.check(key, rule);

    c.header("X-RateLimit-Limit", String(rule.max));
    c.header("X-RateLimit-Remaining", String(result.remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      c.header("Retry-After", String(retryAfter));
      return errorResponse(c, 429, ErrorCode.rateLimited);
    }

    await next();
  });
}
```
>requires: `RATE_LIMIT_MAP` in `../constants/rate-limit` with `{ windowMs, max }` per route key; `RateLimiter` class in `../utils/rate-limiter` (in-memory fixed window, IP-keyed)

## M=secure-headers →src/middleware/secure-headers.ts
```ts
export const secureHeadersMiddleware = secureHeaders({
  crossOriginResourcePolicy: "same-origin",
  crossOriginOpenerPolicy: "same-origin",
  referrerPolicy: "strict-origin-when-cross-origin",
});
```

## M=timing →src/middleware/timing.ts
```ts
export const timingMiddleware = timing();
```
>handlers use `startTime(c, "db")` / `endTime(c, "db")` from hono/timing

## M=error →src/middleware/error.ts
```ts
import { errorResponse } from "../utils/error-response.js";
import { createLogger } from "../utils/logger.js";
import { ErrorCode } from "../constants/errors.js";
import { OutboundRateLimitError, OutboundAuthError, OutboundTransportError } from "../outbound/errors.js";

const log = createLogger("mw:error");

export function registerErrorHandlers(app: Hono<BaseEnv>) {
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    if (err instanceof OutboundRateLimitError) return errorResponse(c, 429, ErrorCode.rateLimited);
    if (err instanceof OutboundAuthError) return errorResponse(c, 502, ErrorCode.badGateway);
    if (err instanceof OutboundTransportError) return errorResponse(c, 502, ErrorCode.badGateway);
    log.error(`${c.req.method} ${c.req.path} unhandled`, { error: err.message });
    return errorResponse(c, 500, ErrorCode.internalError);
  });
  app.notFound((c) => errorResponse(c, 404, ErrorCode.notFound));
}
```

## M=guard →src/middleware/guard.ts
Factory. Checks `c.var.scopes` against required. Per-route inline.
```ts
export function guardMiddleware(...required: string[]) {
  return createMiddleware<{ Variables: { scopes?: string[] } }>(async (c, next) => {
    const missing = required.filter((s) => !(c.get("scopes") ?? []).includes(s));
    if (missing.length) throw new HTTPException(403, { message: `Missing scopes: ${missing.join(", ")}` });
    await next();
  });
}
```

## M=inject →src/middleware/inject.ts
Variables: `{ db: ReturnType<typeof getDb> }`.
```ts
export const injectMiddleware = createMiddleware<BaseEnv>(async (c, next) => {
  c.set("db", getDb(c));
  await next();
});
```
>uses `getDb(c)` from `../db/client.js` — never inline D1 binding directly

## M=internal-auth →src/middleware/internal-auth.ts
```ts
export const internalAuthMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  return bearerAuth({ token: c.env.INTERNAL_API_SECRET })(c, next);
});
```

## Composition order (src/index.ts)
| # | Scope | Middleware | Owner |
|---|-------|-----------|-------|
| 1 | `*` | secureHeadersMiddleware | @mw |
| 2 | `*` | timingMiddleware | @mw |
| 3 | `*` | requestLogger() | @mw |
| 4 | `*` | corsMiddleware | @mw |
| 5 | `/api/*` | sessionMiddleware | @auth |
| 6 | `/api/*` | rateLimit(routeKey) | @mw |
| 7 | `/api/*` | injectMiddleware | @mw |
| 8 | `/internal/*` | internalAuthMiddleware | @mw |
| 9 | per-route | guardMiddleware(...) | @mw |
| last | — | registerErrorHandlers(app) | @mw |

## Combine (hono/combine)
```ts
except(["/api/health"], sessionMiddleware)              // public exempt
every(sessionMiddleware, guardMiddleware("admin"))       // compound gate
```

>createMiddleware=stateless, factory=configurable (rate-limit, guard)
>type Variables for every injected context var
>HTTPException for errors — caught by registerErrorHandlers
>OutboundRateLimitError→429, OutboundAuthError→502, OutboundTransportError→502, else 500
>idempotent: skip if src/middleware/{m}.ts exists

$ARGUMENTS
