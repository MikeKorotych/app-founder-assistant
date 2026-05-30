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
  /** True when the source needs user-owned credentials for any useful access. */
  requiresAuth: boolean;
  /** True when the agent can use the source without credentials in a demo/MVP. */
  canUseWithoutAuth: boolean;
  /** How to obtain credentials (mirrors the integrations table). */
  howToGetAuth: string;
  /** Official API / non-browser scraping status. Keep this user-facing. */
  apiAccess: string;
  /** What this source contributes to app / market research. */
  researchValue: string;
  spec: SpecSource;
}

export const SOURCES: ApiSource[] = [
  {
    id: "itunessearch",
    label: "iTunes Search API",
    auth: "noAuth",
    requiresAuth: false,
    canUseWithoutAuth: true,
    howToGetAuth: "No credentials required",
    apiAccess: "Official free REST API; no Playwright needed.",
    researchValue: "Metadata, reviews, prices and ratings for public iOS apps in the App Store.",
    spec: {
      kind: "unavailable",
      note: "Official REST endpoint, but Apple does not publish an OpenAPI document for codegen.",
    },
  },
  {
    id: "googleplayscraper",
    label: "Unofficial Play Store API",
    auth: "noAuth",
    requiresAuth: false,
    canUseWithoutAuth: true,
    howToGetAuth: "No credentials required",
    apiAccess: "Open-source scraper libraries such as google-play-scraper return JSON without a browser.",
    researchValue: "Public Google Play metadata, ratings, reviews, prices and app listing signals.",
    spec: {
      kind: "unavailable",
      note: "Use a maintained scraper package instead of OpenAPI codegen.",
    },
  },
  {
    id: "reddit",
    label: "Reddit",
    auth: "oauth2",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "reddit.com/prefs/apps",
    apiAccess: "Official API; OAuth required for reliable access.",
    researchValue: "Community discussions, pain points, feature requests and competitor sentiment.",
    // No official OpenAPI doc; vendor a community/hand-written spec here.
    spec: { kind: "local", path: "reddit.openapi.yaml" },
  },
  {
    id: "producthunt",
    label: "Product Hunt",
    auth: "oauth2",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "api.producthunt.com → OAuth",
    apiAccess: "Official GraphQL API; no OpenAPI contract.",
    researchValue: "Launch positioning, maker copy, early adopter feedback and comparable startup launches.",
    // Product Hunt v2 is GraphQL — no OpenAPI contract to generate from.
    spec: { kind: "unavailable", note: "API is GraphQL; use a GraphQL codegen instead." },
  },
  {
    id: "g2",
    label: "G2 (RapidAPI)",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "rapidapi.com → G2 API",
    apiAccess: "Third-party/RapidAPI access; no Playwright needed after subscribing.",
    researchValue: "B2B software reviews, competitor positioning, pricing hints and category alternatives.",
    // An OpenAPI doc exists inside the RapidAPI hub, but exporting it needs a
    // logged-in/subscribed session — no public raw URL. Export and vendor here.
    spec: { kind: "local", path: "g2.openapi.json" },
  },
  {
    id: "capterra",
    label: "Capterra",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "API Request form",
    apiAccess: "Official/partner API access; vendor a local spec for codegen.",
    researchValue: "Software category listings, reviews and competitor discovery for B2B apps.",
    spec: { kind: "local", path: "capterra.openapi.yaml" },
  },
  {
    id: "kickstarter",
    label: "Kickstarter",
    auth: "oauth2",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "kickstarter.com/profile/app_settings",
    apiAccess: "API access with OAuth; local/community spec needed.",
    researchValue: "Crowdfunding demand signals, comparable campaign traction and backer language.",
    spec: { kind: "local", path: "kickstarter.openapi.yaml" },
  },
  {
    id: "appstoreconnect",
    label: "App Store Connect",
    auth: "jwt",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "App Store Connect → Integrations",
    apiAccess: "Official REST API for owned App Store Connect account data.",
    researchValue: "Owned iOS app analytics, sales, subscription, TestFlight and review operations data.",
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
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "Google Cloud Console",
    apiAccess: "Official Android Publisher API for owned Google Play apps.",
    researchValue: "Owned Android app publishing, subscriptions, reviews and store operations data.",
    // androidpublisher ships as a Google Discovery doc; APIs.guru hosts a
    // ready OpenAPI 3 conversion (public, no auth needed to fetch the doc).
    spec: {
      kind: "url",
      url: "https://api.apis.guru/v2/specs/googleapis.com/androidpublisher/v3/openapi.json",
    },
  },
  {
    id: "appfigures",
    label: "Appfigures",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "appfigures.com → Account → API",
    apiAccess: "Official REST API; no Playwright needed.",
    researchValue: "ASO, rankings, downloads, revenue estimates and competitor app intelligence.",
    spec: { kind: "local", path: "appfigures.openapi.yaml" },
  },
  {
    id: "apptopia",
    label: "Apptopia",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "apptopia.com → Account → API",
    apiAccess: "Official API/docs, but no public OpenAPI document.",
    researchValue: "Mobile market intelligence, downloads, revenue estimates and competitor performance.",
    // Docs at dev.apptopia.com are a Slate (Markdown) site — no OpenAPI doc
    // published. Hand-write a spec from the docs and vendor it here.
    spec: { kind: "local", path: "apptopia.openapi.yaml" },
  },
  {
    id: "dataai",
    label: "data.ai (ex-App Annie)",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "data.ai → Account → API",
    apiAccess: "Enterprise API; no Playwright needed, but access is usually high-cost.",
    researchValue: "Mobile analytics, market/category intelligence, downloads, revenue and competitor trends.",
    spec: { kind: "local", path: "dataai.openapi.yaml" },
  },
  {
    id: "apptweak",
    label: "AppTweak",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "apptweak.com → Account → API",
    apiAccess: "Official API with downloadable OpenAPI via ReadMe/Postman, but raw fetch is unreliable.",
    researchValue: "ASO keywords, rankings, creatives, reviews and app store optimization opportunities.",
    // AppTweak DOES publish OpenAPI on its ReadMe portal (developers.apptweak.com,
    // see /llms.txt), but the raw-spec download is bot-gated (Cloudflare 403 /
    // stale ids 302→404) — not reliably fetchable. Export via ReadMe/Postman
    // ("Download OpenAPI") and vendor it here.
    spec: { kind: "local", path: "apptweak.openapi.yaml" },
  },
  {
    id: "crunchbase",
    label: "Crunchbase",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "crunchbase.com → API / Pro or Enterprise plan",
    apiAccess: "Official REST API; paid plan required.",
    researchValue: "Startup/company data: app maker, funding raised, founders, investors and growth stage.",
    spec: { kind: "local", path: "crunchbase.openapi.yaml" },
  },
  {
    id: "trustpilot",
    label: "Trustpilot",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "business.trustpilot.com → Developers / API",
    apiAccess: "Official API; no Playwright needed.",
    researchValue: "Off-store user reviews, complaints about subscriptions, support quality and bugs.",
    spec: { kind: "local", path: "trustpilot.openapi.yaml" },
  },
  {
    id: "similarweb",
    label: "Similarweb",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "similarweb.com → API",
    apiAccess: "Official REST API; no Playwright needed.",
    researchValue: "Traffic sources and acquisition channels for competitor websites and app landing pages.",
    spec: { kind: "local", path: "similarweb.openapi.yaml" },
  },
  {
    id: "appbrain",
    label: "AppBrain",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "appbrain.com → API",
    apiAccess: "Official API; no Playwright needed.",
    researchValue: "Android market stats, SDK popularity, demographics and category trends.",
    spec: { kind: "local", path: "appbrain.openapi.yaml" },
  },
  {
    id: "bigideasdb",
    label: "BigIdeasDB",
    auth: "supabaseAnon",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "bigideasdb.com → Docs → API",
    apiAccess: "Supabase REST API; OpenAPI is available from the REST root with a suitable key.",
    researchValue: "Startup idea database and inspiration corpus for opportunity discovery.",
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
