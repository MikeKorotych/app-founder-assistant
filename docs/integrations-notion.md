# Integrations — активний скоуп (для Notion)

> Стрипнуто до 5 джерел + web_search. Звірено **2026-05-30**.
> Деталі — [integrations-status.md](integrations-status.md); реєстр — `packages/integrations/src/sources.ts`.
> Решта (Product Hunt, G2, Capterra, Kickstarter, Apptopia, data.ai, AppTweak, Appfigures,
> Crunchbase, Trustpilot, Similarweb, AppBrain) — **deferred**, додають інші розробники. BigIdeasDB — скіп.

## Таблиця 1 — Джерела даних (активні)

| Джерело | Тип доступу | Auth / ключ | Вартість | Контракт (типи) | Що дає |
| --- | --- | --- | --- | --- | --- |
| App Store Connect | Офіційний REST | JWT (.p8 + key id + issuer) | Apple Dev $99/рік | generated | Дані **власних** iOS-апів: продажі, підписки, відгуки, TestFlight |
| Google Play | Офіційний REST (Android Publisher) | Service Account (JSON) | Google Play $25 (одноразово) | generated | Дані **власних** Android-апів: підписки, відгуки, публікація |
| Reddit | Офіційний API | OAuth app (тип *script*): client id + secret + User-Agent | $0 | handwritten | Болі спільноти, фічреквести, сентимент по конкурентах |
| Bluesky | Відкритий AT Protocol | Публічні reads — без ключа; `searchPosts` — free app password | $0 | handwritten | Публічні соцпости: болі/сентимент (заміна Twitter) |
| Hacker News | Firebase + Algolia (zero-auth) | — | $0 | handwritten | Startup/tech-болі, лончі, Ask/Show HN, коментарі |
| Claude web_search | Серверний tool Anthropic | наявний `ANTHROPIC_API_KEY` | ~$10 / 1000 пошуків | — (tool) | Catch-all grounding: G2/Capterra/Product Hunt/конкуренти, цитовано |

**Підсумок:** 2 платні (App Store / Google Play — лише власні апи) + 3 безкоштовні (Reddit, Bluesky, Hacker News) + web_search.

## Таблиця 2 — Що створити / заповнити / отримати, щоб швидко стартувати

| # | Дія | Тип | Джерело | Звідки / як | Вартість | env-змінна(і) | Статус |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Apple Developer акаунт | Створити | App Store Connect | developer.apple.com | $99/рік | — | ☐ |
| 2 | App Store Connect API key (.p8) + Key ID + Issuer ID | Отримати | App Store Connect | ASC → Users & Access → Integrations | $0 (в межах акаунта) | `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` | ☐ |
| 3 | Google Play Console акаунт | Створити | Google Play | play.google.com/console | $25 одноразово | — | ☐ |
| 4 | Service Account + JSON-ключ, доступ у Play Console | Отримати | Google Play | Google Cloud Console → IAM → Service Accounts; лінк у Play Console | $0 | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | ☐ |
| 5 | Reddit акаунт | Створити | Reddit | reddit.com | $0 | — | ☐ |
| 6 | Reddit OAuth app (тип *script*) → client id + secret | Отримати | Reddit | reddit.com/prefs/apps → create app | $0 | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | ☐ |
| 7 | Reddit User-Agent рядок | Заповнити | Reddit | вигадати: `app:hahaton:v1 (by /u/...)` | $0 | `REDDIT_USER_AGENT` | ☐ |
| 8 | Bluesky акаунт | Створити | Bluesky | bsky.app | $0 | — | ☐ |
| 9 | Bluesky app password | Отримати | Bluesky | bsky.app → Settings → App Passwords | $0 | `BLUESKY_IDENTIFIER`, `BLUESKY_APP_PASSWORD` | ☐ |
| 10 | Hacker News — нічого | — | Hacker News | zero-auth, працює одразу | $0 | — | ✅ |
| 11 | Anthropic API key (вже є) | Заповнити | web_search | вже в проєкті | в межах API | `ANTHROPIC_API_KEY` | ✅ |
| 12 | npm-пакети (`@anthropic-ai/sdk` вже є; HTTP-клієнти за потреби) | Заповнити | усі | `pnpm add` | $0 | — | ☐ |
| 13 | Node-рантайм для викликів | Заповнити | усі | `apps/api` (Node); Bluesky/HN/web_search ще й Workers-сумісні через `fetch` | $0 | — | ☐ |
| 14 | Скопіювати `.env.example` → `apps/api/.env` і заповнити | Заповнити | усі | `cp .env.example apps/api/.env` | $0 | (усі вище) | ☐ |

### Підсумок «що треба мати»
- **Гроші:** Apple $99/рік + Google $25 одноразово (лише для **власних** апів). Решта — $0 (тільки дрібний web_search-spend).
- **Реєстрації:** Apple, Google Play, Reddit, Bluesky (4 акаунти). Hacker News і web_search — без реєстрації.
- **Контракти типів:** App Store / Google Play — generated; Reddit / Bluesky / Hacker News — handwritten (вже в репо).
