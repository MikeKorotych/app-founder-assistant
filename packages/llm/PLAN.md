# LLM-шлюз: outbound-ядро + LiteLLM-провайдер

> **Єдиний консолідований план інтеграції** (зведено з `specs/llm-gateway-plan.md`).
> Портуємо патерн із `../juliana` у це монорепо як **два окремі пакети**, що
> ділять лише таксономію помилок.
>
> **Статус (станом на цей захід):** код outbound-ядра і LiteLLM-провайдера
> портовано і покрито тестами. Лишилось прошити пайплайн (Етап 4) — відкладено,
> бо `@hahaton/agent` / апки зараз ре-платформляться (Cloudflare/Hono).

## Фінальні рішення

1. **Повний порт outbound-ядра** (`OutboundHttpClient` + усі 5 примітивів) — як база для майбутніх REST-інтеграцій зовнішніх API, не лише LLM. → `@hahaton/outbound`.
2. **LiteLLM — ОКРЕМА сутність** на `openai` SDK. Вона **НЕ** ходить через `OutboundHttpClient`; спирається на openai SDK і ділить з outbound **лише таксономію помилок** (`Outbound*Error`). → `@hahaton/llm`.
3. **D-002:** на user-driven LLM-шляху **немає** `withRetry` і `CircuitBreaker` — рівно як у Juliana (один 5xx заблокував би всіх). Retry лишаємо вбудованому в openai SDK; ми лише **мапимо** помилки.
4. **Модель пакетів — source-export** (як решта монорепо): `exports → ./src/index.ts`, без кроку збірки; бандлер (wrangler/esbuild) компілює все сам. Версії інструментів — через `pnpm catalog:`.

## Архітектура

Два незалежні шари. Єдина точка зв'язку — класи помилок `Outbound*Error`.

```
                       ┌─────────────────────────────┐
   REST-інтеграції ───▶│ OutboundHttpClient (fetch)  │  retry + breaker + timeout
   (майбутні)          │   @hahaton/outbound         │
                       └──────────────┬──────────────┘
                                      │ кидає
                                      ▼
                       ┌─────────────────────────────┐
                       │  таксономія OutboundError    │◀── ділять обидва шари
                       └──────────────▲──────────────┘
                                      │ мапить у неї
                       ┌──────────────┴──────────────┐
   LLM-виклики ───────▶│  LiteLlmProvider            │  openai SDK → LiteLLM proxy
                       │   @hahaton/llm              │  retry = вбудований у SDK
                       └─────────────────────────────┘
```

## Розкладка в монорепо

| Пакет | Призначення | Залежить від |
|---|---|---|
| `@hahaton/outbound` | ядро стійкості: errors, retry, circuit-breaker, safe-normalize, `OutboundHttpClient` | — |
| `@hahaton/llm` | `LiteLlmProvider` (openai SDK), фабрика клієнта, `createLlmProvider`, каталог моделей | `@hahaton/outbound`, `openai` |

Джерела порту (для звірки): `../juliana/packages/outbound/src/*`,
`../juliana/apps/api/src/common/gateway/gateway-client.factory.ts`,
`../juliana/apps/api/src/modules/llm/interfaces/llm-provider.interface.ts`,
`../juliana/apps/api/src/modules/llm/providers/openrouter.provider.ts`.

---

## Етап 1 — Outbound-ядро → `@hahaton/outbound` ✅ ГОТОВО

Прямий порт із `packages/outbound/src` (чистий TS, без NestJS/Prisma):

| Файл | Призначення |
|---|---|
| `errors.ts` | `OutboundError` + 5 підкласів, `isTransientError`, `shouldTripBreaker` |
| `retry.ts` | `withRetry`, `computeDelay`, `DEFAULT_RETRY` |
| `circuit-breaker.ts` | `CircuitBreaker`, `DEFAULT_BREAKER`, `CIRCUIT_STATES` |
| `safe-normalize.ts` | `safeNormalize` |
| `error-message.ts` | `toErrorMessage`, `ErrorFallback` |
| `outbound-http.client.ts` | `OutboundHttpClient` (базовий клас; `get/post/patch/delete` — `protected`) |
| `index.ts` | реекспорт усього |

Правки при копіюванні (зроблено):
- **`OutboundService` звужено** до реальних значень: `{ Litellm: 'litellm' }`. Додавати по факту нових інтеграцій (PascalCase-as-const, за абеткою).
- ESM-сумісність: відносні імпорти лишені з `.js` — резолвляться і `moduleResolution: bundler` (tsc), і vite (vitest).
- Прибрано Juliana-специфічні ADR/work-track-коментарі.

**Тести:** портовано 5 специфікацій (`errors`, `retry`, `circuit-breaker`, `safe-normalize`, `outbound-http.client`) — ін'єктять `fetchImpl`/`sleep`/`now`, без мережі. Сервіси в тестах перейменовано на `Litellm`. **57 тестів зелені** (`pnpm --filter @hahaton/outbound test`).

## Етап 2 — Документація / скіл outbound ⏳ ОПЦІЙНО

Не блокує інтеграцію. За потреби портувати адаптований `provider`-гайд
(`consumer → provider → client → mapper → errors`) з `../juliana/.claude/commands/provider.md`
у `docs/` або `.claude/`, прибравши NestJS DI/Prisma/Ashby-Zoho специфіку.

## Етап 3 — LiteLLM-провайдер → `@hahaton/llm` ✅ ГОТОВО

| Файл | Призначення |
|---|---|
| `llm-provider.ts` | інтерфейс-шов `LlmProvider` + OpenAI-формат типів (`LlmRequest/Response`, `LlmChat*`, `CacheControl*`, `LlmToolCall`) |
| `gateway-client.factory.ts` | `createGatewayClient({ baseUrl, apiKey, timeoutMs }) → OpenAI` |
| `litellm.provider.ts` | `LiteLlmProvider implements LlmProvider` (порт `OpenRouterProvider`, без NestJS) |
| `factory.ts` | `createLlmProvider(env) → LlmProvider` |
| `catalog.ts` | `MODELS = { opus, sonnet, haiku }` — аліаси LiteLLM `model_list` |
| `index.ts` | barrel |

Ключове в `LiteLlmProvider`:
- конструктор: `createGatewayClient(...)`; `maxRetries` лишається на openai SDK;
- `complete`/`chat`: `client.chat.completions.create(...)`;
- `handleApiError`: `OpenAI.AuthenticationError/RateLimitError/APIError` → `OutboundAuthError/RateLimitError/TransportError` (`service: OutboundService.Litellm`); інше → `OutboundError(kind: Unknown)`. **Без `HttpException`** — кидаємо `Outbound*` вгору;
- usage-трекінг: `prompt_tokens`, `completion_tokens`, `prompt_tokens_details.cached_tokens / cache_write_tokens`.

**Тести:** `gateway-client.factory.spec.ts` + `litellm.provider.spec.ts` (мапінг auth/rate-limit/transport/unknown + empty-response, через ін'єкцію фейкового gateway-клієнта). **7 тестів зелені** (`pnpm --filter @hahaton/llm test`).

> Примітка по тестах: моки `chat.completions.create` кидають **синхронно**
> (`mockImplementation(() => { throw … })`), а не через `mockRejectedValue` —
> інакше vitest позначає записаний у `mock.results` rejected-promise як
> unhandled і валить тест. `await create()` синхронний throw однаково ловить.

## Етап 4 — Прошивка пайплайну ✅ ГОТОВО

Зроблено (не залежить від Cloudflare-міграції; провайдер ін'єктиться, env читає апка):

1. `@hahaton/contracts` → `types.ts`: подію `error` розширено опційними `kind?: string` + `retryable?: boolean` (для SSE/UI). Контракти лишаються zero-dep (`kind` — простий рядок зі значень `OutboundErrorKind`, без імпорту outbound).
2. `@hahaton/agent` → `steps/index.ts`: `StepContext.client: Anthropic` → `StepContext.llm: LlmProvider` (з `@hahaton/llm`). У залежності agent додано `@hahaton/llm` + `@hahaton/outbound`.
3. `@hahaton/agent` → `orchestrator.ts`: `RunPipelineOptions.apiKey` → `RunPipelineOptions.llm: LlmProvider` (ін'єкція). `new Anthropic(...)` прибрано. `MODELS` реекспортуються з `@hahaton/llm` (аліаси LiteLLM), а не Anthropic-нативні ID.
4. `@hahaton/agent` → `simple.ts`: `runAgent(prompt, llm)` → `llm.complete(...)` з `MODELS.sonnet`.
5. `@hahaton/agent` → `error-meta.ts` (новий): `errorMeta(err)` — якщо `err instanceof OutboundError`, кладе `kind` + `retryable` у подію `error`. Викликається в `step()`-обгортці та в catch оркестратора.
6. `@anthropic-ai/sdk` прибрано з `@hahaton/agent`.
7. `apps/api`: `createLlmProvider(c.env)` будує провайдера з Worker-біндингів і передається в `runAgent` / `runPipeline`. `env.ts → requireLlmEnv` тепер валідує `LLM_GATEWAY_BASE_URL` + `LLM_GATEWAY_API_KEY` (+ `DB`). `@hahaton/llm` додано в залежності апки.

> `createLlmProvider(env)` приймає env **обов'язково** (без `process.env`-дефолту) — у Workers `process.env` немає; апка передає `c.env`.
>
> **Перевірено:** typecheck `contracts/outbound/llm/agent/api` — чисто; тести `outbound` (57) + `llm` (7) — зелені.

## Етап 5 — Конфіг і залежності

- `@hahaton/llm`: `+ openai` (dependency). ✅
- `vitest` / `typescript` — через `catalog:`. ✅
- **Env** (локально `.env`; на Cloudflare — `wrangler` vars / secrets):
  ```
  LLM_GATEWAY_BASE_URL=http://localhost:4000/v1   # LiteLLM proxy
  LLM_GATEWAY_API_KEY=sk-...                        # LiteLLM master/virtual key
  LLM_TIMEOUT_MS=120000
  ```
- **Каталог моделей:** аліаси `opus/sonnet/haiku` у `catalog.ts` **мають існувати** в `model_list` LiteLLM, інакше шлюз віддасть 400.

## Етап 6 — Перевірка

- `pnpm --filter @hahaton/outbound test` → 57 ✅
- `pnpm --filter @hahaton/llm test` → 7 ✅
- `pnpm --filter @hahaton/{outbound,llm} typecheck` → чисто ✅
- Після Етапу 4: локальний LiteLLM (`litellm --config …`) + dummy-крок → `complete()` працює; невалідний ключ → `OutboundAuthError`.

---

## Ризики / відкриті питання

1. **web_search.** Кроки `market`/`competitors` потребують пошуку. Нативний Anthropic `web_search` у OpenAI-форматі недоступний → або модель з web-tool на боці LiteLLM, або окремий search-провайдер як `LlmToolDefinition`. **Вирішити до реалізації кроків 2-3.**
2. **Prompt caching.** Anthropic `cache_control` проходить лише якщо LiteLLM його пробрасує (тип уже передбачено в `LlmChatContentBlock.cacheControl`).
3. **Content-blocks.** Anthropic→OpenAI: система — окреме повідомлення (`role:'system'`), не top-level `system` (вже так у `complete`/`chat`).
4. **Model-аліаси** мають існувати в `model_list` LiteLLM, інакше 400.
5. **Cloudflare Workers runtime.** `openai` SDK на `fetch` працює у Workers, але перевірити таймаути/стрімінг під час прошивки апки.
