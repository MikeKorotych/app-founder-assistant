# Vendored OpenAPI specs

The generator (`pnpm generate:contracts`) pulls each contract from the
source declared in [`src/sources.ts`](../src/sources.ts).
There are three kinds of source:

| Kind          | What happens                                              | Needs from you            |
| ------------- | --------------------------------------------------------- | ------------------------- |
| `url`         | fetched over HTTP (+ optional auth headers from env)      | nothing, or env vars      |
| `local`       | read from a file in this folder                           | drop the spec file here   |
| `unavailable` | skipped with a printed reason                             | —                         |

## Works out of the box (no credentials)

- **iTunes Search API** — public official REST API. No OpenAPI document is
  published, so it is integrated directly rather than generated from a spec.
- **Unofficial Play Store API** — public data via libraries such as
  `google-play-scraper`. No browser or Playwright required; no OpenAPI codegen.
- **App Store Connect** — `url`, public community mirror of Apple's spec.
- **Google Play** — `url`, APIs.guru's OpenAPI conversion of the androidpublisher Discovery doc.

## Works once you set env vars

- **AppMagic** — set `APPMAGIC_API_KEY`. Premium API access is required; no
  bot/UI is needed once the key exists.
- **Sensor Tower** — set `SENSOR_TOWER_API_KEY`. Access is through Sensor
  Tower Connect / enterprise API.
- **AppTweak** — set `APPTWEAK_API_KEY`. The token is available in the account
  API tab / dashboard API settings.
- **Mobile Action** — set `MOBILE_ACTION_API_KEY`. Runtime requests inject it
  as `token=...`; `/api-key` can verify remaining credits.
- **BigIdeasDB** (Supabase) — set `BIGIDEASDB_URL` and `BIGIDEASDB_KEY`.
  Newer Supabase projects don't expose the OpenAPI doc to the anon key, so use a
  key that can read it (service_role in dev).

## Need a spec file dropped here (no official OpenAPI exists anywhere)

| File                        | Source        | Where to get it                                       |
| --------------------------- | ------------- | ----------------------------------------------------- |
| `reddit.openapi.yaml`       | Reddit        | hand-write / vendor a community spec from the API docs |
| `g2.openapi.json`           | G2 (RapidAPI) | export from the RapidAPI listing's OpenAPI tab        |
| `capterra.openapi.yaml`     | Capterra      | hand-write from their API docs                        |
| `kickstarter.openapi.yaml`  | Kickstarter   | hand-write from their API docs                        |
| `appfigures.openapi.yaml`   | Appfigures    | hand-write / export from their API docs               |
| `appmagic.openapi.yaml`     | AppMagic      | hand-write / export from paid API docs                |
| `sensortower.openapi.yaml`  | Sensor Tower  | hand-write / export from Connect API docs             |
| `apptopia.openapi.yaml`     | Apptopia      | hand-write from their API docs                        |
| `dataai.openapi.yaml`       | data.ai       | hand-write from their API docs                        |
| `apptweak.openapi.yaml`     | AppTweak      | hand-write from their API docs                        |
| `crunchbase.openapi.yaml`   | Crunchbase    | hand-write / export from their API docs               |
| `trustpilot.openapi.yaml`   | Trustpilot    | hand-write / export from their API docs               |
| `similarweb.openapi.yaml`   | Similarweb    | hand-write / export from their API docs               |
| `appbrain.openapi.yaml`     | AppBrain      | hand-write / export from their API docs               |
| `mobileaction.openapi.yaml` | Mobile Action | hand-write / export from their API docs               |

## Skipped on purpose

- **Product Hunt** — the API is GraphQL, so there's no OpenAPI to generate from.
  Use a GraphQL codegen against their schema instead.
- **iTunes Search API** and **Unofficial Play Store API** — both are usable
  without credentials, but neither has an OpenAPI document suitable for this
  generator.
