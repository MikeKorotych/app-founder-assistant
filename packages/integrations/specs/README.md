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

- **App Store Connect** — `url`, public community mirror of Apple's spec.
- **Google Play** — `url`, APIs.guru's OpenAPI conversion of the androidpublisher Discovery doc.

## Works once you set env vars

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
| `apptopia.openapi.yaml`     | Apptopia      | hand-write from their API docs                        |
| `dataai.openapi.yaml`       | data.ai       | hand-write from their API docs                        |
| `apptweak.openapi.yaml`     | AppTweak      | hand-write from their API docs                        |

## Skipped on purpose

- **Product Hunt** — the API is GraphQL, so there's no OpenAPI to generate from.
  Use a GraphQL codegen against their schema instead.
