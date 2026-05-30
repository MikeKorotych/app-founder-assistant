# Integrations status — стан контрактів зовнішніх API

> Джерело істини для стану інтеграцій. Звідки беруться факти: реєстр
> [`packages/integrations/src/sources.ts`](../packages/integrations/src/sources.ts),
> теки `generated/` + `handwritten/`, і прогін `pnpm --filter @hahaton/integrations generate:contracts`.
> Останнє звірення: **2026-05-30**. 18 джерел.

## Як це влаштовано — три форми контракту

| Форма | Де лежить | Як зʼявляється | Комітиться? |
| --- | --- | --- | --- |
| **generated** | `src/generated/<id>.d.ts` | авто з fetch-абельного OpenAPI URL (`spec.kind: "url"`) | ні (git-ignored, регенерується) |
| **handwritten** | `src/handwritten/<id>.ts` | рукописні типи з документації / GraphQL-схеми / reverse-engineered JSON | так |
| **local** *(чекає)* | `specs/<id>.openapi.*` | хтось має покласти vendored OpenAPI-файл | так (але зараз файлів нема) |

Окремо `spec.kind: "unavailable"` — джерело свідомо без OpenAPI (REST без спеки, scraper, GraphQL).

Легенда стану: ✅ типізовано й готово · 🟡 готово після однієї дії · 🔴 прогалина (контракту нема).

---

## ✅ Готово — можна одразу ковиряти API

Контракт існує; для реальних викликів майже всім ще потрібні креденшели (але типи вже є).

| Джерело | Форма | Auth для викликів | Дослідницька цінність |
| --- | --- | --- | --- |
| **App Store Connect** | generated (url, публічний) | JWT | власна iOS-аналітика, продажі, підписки, TestFlight |
| **Google Play** | generated (url, APIs.guru) | Service Account | власний Android: публікація, підписки, відгуки |
| **Reddit** | handwritten | OAuth2 + User-Agent | болі спільноти, фічреквести, сентимент по конкурентах |
| **Product Hunt** | handwritten (GraphQL) | OAuth2 Bearer | позиціонування лончів, фідбек early adopters |
| **G2** | handwritten | RapidAPI key | B2B-відгуки, позиціонування, альтернативи в категорії |
| **Capterra** | handwritten | API key (account manager) | каталог софту, відгуки, дискавері конкурентів |
| **Kickstarter** | handwritten | — (undocumented `?format=json`) | сигнали попиту, тяга кампаній, мова бекерів |
| **Apptopia** | handwritten | API token | mobile market intel, оцінки downloads/revenue |
| **data.ai** | handwritten | Bearer key | mobile-аналітика, категорійна розвідка, тренди |
| **AppTweak** | handwritten | `x-apptweak-key` | ASO-кейворди, ранки, креативи, відгуки |

**10 / 18 типізовані.**

---

## ⏭️ Свідомо скіпнуто

| Джерело | Чому скіпнули |
| --- | --- |
| **BigIdeasDB** | Скіпнуто з трьох причин (деталі нижче). |

**BigIdeasDB — чому скіп:**
1. **Платний продукт** ($125+ lifetime / $45 на міс). Free-доступ — це лише UI-демо; будь-який API/експорт за платним планом.
2. **Форма API не підтверджена.** Реєстр припускав Supabase REST з anon-ключем на `/rest/v1/`, але їхні доки рекламують **MCP-сервер**, а не задокументований REST-контракт. Перевірити не вдалося: сайт за Vercel WAF, який 403-ить будь-який автоматичний доступ (і подеколи блокує живі браузери через VPN/регіон).
3. **Низька маржинальна цінність.** Датасет (пре-валідовані ідеї з Reddit/G2/Capterra) дублює те, що наш grounded-ресерч-пайплайн і так збирає.

Статус у реєстрі: `spec.kind: "unavailable"`. Env не потрібен.

---

## 🔴 Прогалини — контракту нема, треба додати

Ці джерела є в реєстрі лише з `spec.kind: "local"` на **неіснуючий** файл — ні generated, ні handwritten, ні vendored-спеки. Генератор їх скіпає.

| Джерело | Auth | Як закрити |
| --- | --- | --- |
| **Appfigures** | apiKey | офіційний REST — написати handwritten або vendor-нути OpenAPI |
| **Crunchbase** | apiKey (платний) | офіційний REST — handwritten з доків |
| **Trustpilot** | apiKey | офіційний API — handwritten з доків |
| **Similarweb** | apiKey | офіційний REST — handwritten з доків |
| **AppBrain** | apiKey | офіційний API — handwritten з доків |

Плюс свідомо `unavailable`, але **без типів** (можна додати handwritten, якщо знадобиться):

| Джерело | Стан | Коментар |
| --- | --- | --- |
| **iTunes Search API** | REST без OpenAPI | простий публічний API — handwritten зробити легко |
| **Unofficial Play Store** | scraper | типи від обраної бібліотеки (`google-play-scraper`), не наш контракт |

---

## ⚠️ Неузгодженість, яку варто причесати

Для 8 handwritten-джерел (Reddit, Product Hunt, G2, Capterra, Kickstarter, Apptopia, data.ai, AppTweak)
реєстр досі тримає `spec: { kind: "local", path: "<...>.openapi.yaml" }` на файли, яких **ніколи не буде** —
генератор їх вічно скіпатиме з «local spec not found». Реальний контракт для них — файл у `handwritten/`.

Варіанти:
- **(а)** додати в реєстр `spec.kind: "handwritten"` (і навчити генератор пропускати їх тихо, без warning), **або**
- **(б)** лишити як є, памʼятаючи: для цих 8 джерело правди — `handwritten/`, а `specs/` для них ігнорується.

---

## Підсумок

**Типізовано та готово: 10/18.** **Скіпнуто: 1** (BigIdeasDB — платний, форма API не підтверджена, дублює ресерч).
**Прогалини: 7** — 5 нових (Appfigures, Crunchbase, Trustpilot, Similarweb, AppBrain) + 2 без типів (iTunes Search, Play-scraper).
