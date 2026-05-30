import type { AuthKind } from "./auth.js";

/**
 * Where an OpenAPI document comes from.
 *
 *  - `url`         remote OpenAPI/Swagger doc, optionally behind auth headers
 *                  (header values are read from env at generation time).
 *  - `local`       a spec file checked into ./specs (hand-written or vendored,
 *                  for APIs that don't publish a machine-readable contract).
 *  - `unavailable` no OpenAPI doc exists in a form openapi-typescript can read
 *                  (e.g. GraphQL or a Google Discovery doc) — skipped with a note.
 */
export type SpecSource =
  | { kind: "url"; url: string; headersFromEnv?: Record<string, string> }
  | { kind: "local"; path: string }
  | { kind: "unavailable"; note: string };

export interface ApiSource {
  /** Stable id — also the generated file name: generated/<id>.d.ts */
  id: string;
  label: string;
  auth: AuthKind;
  /** How to obtain credentials (mirrors the integrations table). */
  howToGetAuth: string;
  spec: SpecSource;
}

export const SOURCES: ApiSource[] = [
  {
    id: "reddit",
    label: "Reddit",
    auth: "oauth2",
    howToGetAuth: "reddit.com/prefs/apps",
    // No official OpenAPI doc; vendor a community/hand-written spec here.
    spec: { kind: "local", path: "reddit.openapi.yaml" },
  },
  {
    id: "producthunt",
    label: "Product Hunt",
    auth: "oauth2",
    howToGetAuth: "api.producthunt.com → OAuth",
    // Product Hunt v2 is GraphQL — no OpenAPI contract to generate from.
    spec: { kind: "unavailable", note: "API is GraphQL; use a GraphQL codegen instead." },
  },
  {
    id: "g2",
    label: "G2 (RapidAPI)",
    auth: "apiKey",
    howToGetAuth: "rapidapi.com → G2 API",
    // An OpenAPI doc exists inside the RapidAPI hub, but exporting it needs a
    // logged-in/subscribed session — no public raw URL. Export and vendor here.
    spec: { kind: "local", path: "g2.openapi.json" },
  },
  {
    id: "capterra",
    label: "Capterra",
    auth: "apiKey",
    howToGetAuth: "API Request form",
    spec: { kind: "local", path: "capterra.openapi.yaml" },
  },
  {
    id: "kickstarter",
    label: "Kickstarter",
    auth: "oauth2",
    howToGetAuth: "kickstarter.com/profile/app_settings",
    spec: { kind: "local", path: "kickstarter.openapi.yaml" },
  },
  {
    id: "appstoreconnect",
    label: "App Store Connect",
    auth: "jwt",
    howToGetAuth: "App Store Connect → Integrations",
    // Apple publishes the spec as a zip; this community mirror tracks the
    // latest copy as raw JSON (public, no auth needed to fetch the doc).
    spec: {
      kind: "url",
      url: "https://raw.githubusercontent.com/EvanBacon/App-Store-Connect-OpenAPI-Spec/main/specs/latest.json",
    },
  },
  {
    id: "googleplay",
    label: "Google Play",
    auth: "serviceAccount",
    howToGetAuth: "Google Cloud Console",
    // androidpublisher ships as a Google Discovery doc; APIs.guru hosts a
    // ready OpenAPI 3 conversion (public, no auth needed to fetch the doc).
    spec: {
      kind: "url",
      url: "https://api.apis.guru/v2/specs/googleapis.com/androidpublisher/v3/openapi.json",
    },
  },
  {
    id: "apptopia",
    label: "Apptopia",
    auth: "apiKey",
    howToGetAuth: "apptopia.com → Account → API",
    // Docs at dev.apptopia.com are a Slate (Markdown) site — no OpenAPI doc
    // published. Hand-write a spec from the docs and vendor it here.
    spec: { kind: "local", path: "apptopia.openapi.yaml" },
  },
  {
    id: "dataai",
    label: "data.ai",
    auth: "apiKey",
    howToGetAuth: "data.ai → Account → API",
    spec: { kind: "local", path: "dataai.openapi.yaml" },
  },
  {
    id: "apptweak",
    label: "AppTweak",
    auth: "apiKey",
    howToGetAuth: "apptweak.com → Account → API",
    // AppTweak DOES publish OpenAPI on its ReadMe portal (developers.apptweak.com,
    // see /llms.txt), but the raw-spec download is bot-gated (Cloudflare 403 /
    // stale ids 302→404) — not reliably fetchable. Export via ReadMe/Postman
    // ("Download OpenAPI") and vendor it here.
    spec: { kind: "local", path: "apptweak.openapi.yaml" },
  },
  {
    id: "bigideasdb",
    label: "BigIdeasDB",
    auth: "supabaseAnon",
    howToGetAuth: "bigideasdb.com → Docs → API",
    // Supabase auto-serves its OpenAPI (Swagger 2.0) at the REST root.
    // Newer projects no longer expose it via the anon key — use a key that
    // can read the spec (service_role in dev). Set BIGIDEASDB_URL + _KEY.
    spec: {
      kind: "url",
      url: "${BIGIDEASDB_URL}/rest/v1/",
      headersFromEnv: {
        apikey: "BIGIDEASDB_KEY",
        Authorization: "Bearer:BIGIDEASDB_KEY",
      },
    },
  },
];
