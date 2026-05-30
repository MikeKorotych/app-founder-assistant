# План: outbound-абстракція + LiteLLM (окрема сутність на openai SDK)

> Портуємо патерн із `../juliana` у `hahaton-2026`. **Фінальні рішення:**
> 1. Портуємо **повний** outbound-пакет (`OutboundHttpClient` + усі 5 примітивів) — для майбутніх REST-інтеграцій зовнішніх API.
> 2. Портуємо **документацію/скіли**, що пояснюють, як цим клієнтом користуватись.
> 3. **LiteLLM — ОКРЕМА сутність** на `openai` SDK, працює як у Juliana. Вона **НЕ** ходить через `OutboundHttpClient`; спирається на openai SDK і ділить з outbound **лише таксономію помилок**.
> 4. Цей файл — план; код поки не чіпаємо.

## Архітектурне рішення (важливо)

Два незалежні шари. Єдина точка зв'язку — класи помилок `Outbound*Error`.

```
                       ┌─────────────────────────────┐
   REST-інтеграції ───▶│ OutboundHttpClient (fetch)  │  retry + breaker + timeout
   (Ashby/…, майбутні) │   src/outbound/             │
                       └──────────────┬──────────────┘
                                      │ кидає
                                      ▼
                       ┌─────────────────────────────┐
                       │  таксономія OutboundError    │◀── ділять обидва шари
                       └──────────────▲──────────────┘
                                      │ мапить у неї
                       ┌──────────────┴──────────────┐
   LLM-виклики ───────▶│  LiteLLM provider           │  openai SDK (як у Juliana)
                       │   src/llm/  (openai SDK)     │  retry = вбудований у SDK
                       └─────────────────────────────┘
```

- `OutboundHttpClient` (transport, fetch) ↔ REST-клієнти, що його **наслідують**.
- LiteLLM-провайдер сидить на **openai SDK**, retry робить сам SDK; ми лише **мапимо** його помилки в `OutboundAuthError/RateLimitError/TransportError` (як `handleApiError` у Juliana). Без `withRetry`, без `CircuitBreaker` на LLM-шляху — рівно як у Juliana (D-002: breaker на user-driven LLM не вішають, бо один 5xx заблокував би всіх).

Джерела для порту:
- `../juliana/packages/outbound/src/*` — ядро стійкості.
- `../juliana/packages/outbound/README.md` — гайд по `OutboundHttpClient` (перенести як доку).
- `../juliana/.claude/commands/provider.md` — скіл «як зібрати provider→client→mapper→errors поверх outbound».
- `../juliana/apps/api/src/common/gateway/gateway-client.factory.ts` — фабрика openai-клієнта.
- `../juliana/apps/api/src/modules/llm/interfaces/llm-provider.interface.ts` — інтерфейс провайдера.
- `../juliana/apps/api/src/modules/llm/providers/openrouter.provider.ts` — `handleApiError` (мапінг помилок).

---

## Етап 1 — Повний порт outbound-ядра → `src/outbound/`

Прямий порт із `packages/outbound/src` (чистий TS, без NestJS/Prisma). П'ять примітивів + barrel:

| Файл | Призначення |
|---|---|
| `errors.ts` | `OutboundError` + 5 підкласів, `isTransientError`, `shouldTripBreaker` |
| `retry.ts` | `withRetry`, `computeDelay`, `DEFAULT_RETRY` |
| `circuit-breaker.ts` | `CircuitBreaker`, `DEFAULT_BREAKER`, `CIRCUIT_STATES` |
| `safe-normalize.ts` | `safeNormalize` |
| `error-message.ts` | `toErrorMessage`, `ErrorFallback` |
| `outbound-http.client.ts` | `OutboundHttpClient` (базовий клас; `get/post/patch/delete` — `protected`) |
| `index.ts` | реекспорт усього |

Правки при копіюванні:
- **ESM**: проєкт `"type": "module"` → у всіх внутрішніх імпортах додати `.js` (`from './errors.js'`). У Juliana розширень немає.
- `OutboundService` (в `errors.ts`) звузити до реальних значень: `{ Litellm: 'litellm', ... }` + додавати по факту нових інтеграцій (правило з README: PascalCase-as-const, сортувати за абеткою).
- Прибрати посилання на Juliana-специфічні ADR/work-track у коментарях, якщо є.

Тести (vitest): портувати `*.spec.ts` (`errors`, `retry`, `circuit-breaker`, `safe-normalize`, `outbound-http.client`). Вони ін'єктять `fetchImpl`/`sleep`/`now` — без мережі й реальних затримок.

## Етап 2 — Документація / скіли outbound → `docs/outbound/` (+ `.claude/`)

«Усі скіли, що пояснюють, як користуватись клієнтом для зовнішніх інтеграцій»:

1. **`docs/outbound/README.md`** — адаптований порт `packages/outbound/README.md`:
   - лишити: 5 примітивів, приклад «як клієнт наслідує `OutboundHttpClient`», таблицю конфіг-ручок, «retry vs breaker — що чим є», edge-cases (Retry-After, half-open, 200-з-помилкою → `errorMapper`), «коли вимикати breaker».
   - прибрати: посилання на ADR/work-track/`pnpm --filter`, згадки NestJS `Logger`, інбаунд-вебхуки.
2. **`.claude/commands/provider.md`** (або `docs/outbound/provider-guide.md`) — адаптований порт `/provider`-скіла: шар `consumer → provider → client → mapper → errors`, приклади client (`extends OutboundHttpClient`), mapper (`safeNormalize`), errors (`errorMapper`).
   - прибрати: `ConfigService`/NestJS DI → читання env напряму; Prisma/domain-типи; стиль-правила root CLAUDE.md Juliana (no-`while`/no-`let`/no-comments) — лишити лише ті, що команда свідомо хоче.
3. **НЕ** тягнемо `integrations/CLAUDE.md` — він про Prisma/sync/AccessLog/Ashby-Zoho-BlueDot, нерелевантно.

## Етап 3 — LiteLLM-провайдер (окрема сутність) → `src/llm/`

`src/llm/llm-provider.ts` — інтерфейс-шов + типи (OpenAI-формат):
```ts
export interface LlmRequest { systemPrompt; userPrompt; model; maxTokens; temperature }
export interface LlmResponse { content: string; model: string }
export interface LlmChatRequest { messages; model; maxTokens; temperature; tools? }
export interface LlmChatResponse { content; model; usage; toolCalls? }
export interface LlmProvider { readonly name; complete(req); chat(req) }
```

`src/llm/gateway-client.factory.ts` — порт фабрики:
```ts
export function createGatewayClient(cfg: { baseUrl; apiKey; timeoutMs }): OpenAI
```

`src/llm/litellm.provider.ts` — реалізація `LlmProvider` (порт `OpenRouterProvider`, як є):
- конструктор: `createGatewayClient({ baseUrl, apiKey, timeoutMs })`; `maxRetries` лишаємо на openai SDK (вбудований retry);
- `complete`/`chat`: `client.chat.completions.create(...)`;
- `handleApiError`: `OpenAI.AuthenticationError/RateLimitError/APIError` → `OutboundAuthError/RateLimitError/TransportError` (`service: OutboundService.Litellm`), далі кидаємо вгору;
- usage-трекінг: `prompt_tokens`, `completion_tokens`, `prompt_tokens_details.cached_tokens`.

`src/llm/factory.ts` — `createLlmProvider(env): LlmProvider`.

`src/llm/catalog.ts` — `MODELS = { opus, sonnet, haiku }` → ID/аліаси з `model_list` LiteLLM (не Anthropic-нативні).

## Етап 4 — Прошивка пайплайну

- `src/agent/steps/index.ts`: `StepContext.client: Anthropic` → `StepContext.llm: LlmProvider`.
- `src/agent/orchestrator.ts`: замість `new Anthropic(...)` → `createLlmProvider(process.env)`.
- `src/agent.ts` (`runAgent`): переписати на `provider.complete(...)`.
- `catch` у кроках/пайплайні: якщо `err instanceof OutboundError` — у подію `error` класти `kind` + `retryable` (для SSE/UI). Розширити тип події в `src/shared/types.ts` опційними полями.

## Етап 5 — Конфіг і залежності

`package.json`:
- `+ openai` (dependencies).
- `+ vitest` (devDependencies), скрипт `"test": "vitest run"`.
- `@anthropic-ai/sdk` — лишити або прибрати, коли LiteLLM повністю замінить прямі виклики (рішення під час реалізації).

`.env.example`:
```
LLM_GATEWAY_BASE_URL=http://localhost:4000/v1   # LiteLLM proxy
LLM_GATEWAY_API_KEY=sk-...                        # LiteLLM master/virtual key
LLM_TIMEOUT_MS=120000
```

## Етап 6 — Перевірка

- `npm run typecheck` — зелено.
- `npm test` — портовані outbound-специфікації проходять.
- Локальний LiteLLM (`litellm --config ...`) + dummy-крок → `complete()` працює; невалідний ключ → `OutboundAuthError`.

---

## Ризики / відкриті питання

1. **web_search.** Кроки `market`/`competitors` потребують пошуку. Нативний Anthropic `web_search` у OpenAI-форматі недоступний → або модель з web-tool на боці LiteLLM, або окремий search-провайдер як `LlmToolDefinition`. **Вирішити до реалізації кроків 2-3.**
2. **Prompt caching.** Anthropic `cache_control` проходить лише якщо LiteLLM його пробрасує.
3. **Content-blocks.** Anthropic→OpenAI: система — окреме повідомлення (`role:'system'`), не top-level `system`.
4. **Model-аліаси** мають існувати в `model_list` LiteLLM, інакше 400.
