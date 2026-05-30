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

export interface ApiKeyConfig {
  /** Environment variable / Cloudflare secret name that stores the key. */
  envVar: string;
  /** Where to inject the key for runtime requests. */
  placement: "header" | "query";
  /** Header or query-param name, depending on placement. */
  name: string;
  /** Optional value prefix, e.g. "Bearer ". */
  prefix?: string;
  /** Lightweight endpoint to verify that credentials are wired. */
  checkUrl?: string;
}

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
  /** Whether a browser/user action is needed after the key exists. */
  needsBotOrUi: boolean;
  /** Rough setup time once the account has API access. */
  startupTime: string;
  /** Runtime API-key injection config when auth === "apiKey". */
  apiKey?: ApiKeyConfig;
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
    needsBotOrUi: false,
    startupTime: "0 min",
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
    needsBotOrUi: false,
    startupTime: "0 min",
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
    needsBotOrUi: false,
    startupTime: "15 min",
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
    needsBotOrUi: false,
    startupTime: "15 min",
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
    needsBotOrUi: false,
    startupTime: "15 min",
    apiKey: { envVar: "G2_API_KEY", placement: "header", name: "x-rapidapi-key" },
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
    needsBotOrUi: false,
    startupTime: "15 min",
    apiKey: { envVar: "CAPTERRA_API_KEY", placement: "header", name: "Authorization", prefix: "Bearer " },
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
    needsBotOrUi: false,
    startupTime: "15 min",
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
    needsBotOrUi: false,
    startupTime: "20 min",
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
    needsBotOrUi: false,
    startupTime: "20 min",
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
    needsBotOrUi: false,
    startupTime: "15 min",
    apiKey: { envVar: "APPFIGURES_API_KEY", placement: "header", name: "Authorization", prefix: "Bearer " },
    spec: { kind: "local", path: "appfigures.openapi.yaml" },
  },
  {
    id: "appmagic",
    label: "AppMagic",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "appmagic.rocks -> Profile -> API Access (Premium)",
    apiAccess: "Official API with 50+ endpoints; no Playwright needed.",
    researchValue: "Mobile market and competitor intelligence: downloads, revenue, rankings, creatives and category trends.",
    needsBotOrUi: false,
    startupTime: "15 min",
    apiKey: { envVar: "APPMAGIC_API_KEY", placement: "header", name: "Authorization", prefix: "Bearer " },
    spec: { kind: "local", path: "appmagic.openapi.yaml" },
  },
  {
    id: "sensortower",
    label: "Sensor Tower",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "sensortower.com -> Request Demo / Connect API",
    apiAccess: "Official Connect API / data feed; enterprise access required.",
    researchValue: "Enterprise mobile, web, audience and advertising intelligence for competitor and market analysis.",
    needsBotOrUi: false,
    startupTime: "30+ min",
    apiKey: { envVar: "SENSOR_TOWER_API_KEY", placement: "query", name: "auth_token" },
    spec: { kind: "local", path: "sensortower.openapi.yaml" },
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
    needsBotOrUi: false,
    startupTime: "15 min",
    apiKey: { envVar: "APPTOPIA_API_KEY", placement: "header", name: "Authorization", prefix: "Bearer " },
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
    needsBotOrUi: false,
    startupTime: "30+ min",
    apiKey: { envVar: "DATAAI_API_KEY", placement: "header", name: "Authorization", prefix: "Bearer " },
    spec: { kind: "local", path: "dataai.openapi.yaml" },
  },
  {
    id: "apptweak",
    label: "AppTweak",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "apptweak.com -> API Documentation / Dashboard API tab -> Generate token",
    apiAccess: "Official API with downloadable OpenAPI via ReadMe/Postman, but raw fetch is unreliable.",
    researchValue: "ASO keywords, rankings, creatives, reviews and app store optimization opportunities.",
    needsBotOrUi: false,
    startupTime: "15 min",
    apiKey: { envVar: "APPTWEAK_API_KEY", placement: "header", name: "Authorization", prefix: "Bearer " },
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
    needsBotOrUi: false,
    startupTime: "15 min",
    apiKey: { envVar: "CRUNCHBASE_API_KEY", placement: "header", name: "X-cb-user-key" },
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
    needsBotOrUi: false,
    startupTime: "15 min",
    apiKey: { envVar: "TRUSTPILOT_API_KEY", placement: "header", name: "apikey" },
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
    needsBotOrUi: false,
    startupTime: "15 min",
    apiKey: { envVar: "SIMILARWEB_API_KEY", placement: "query", name: "api_key" },
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
    needsBotOrUi: false,
    startupTime: "15 min",
    apiKey: { envVar: "APPBRAIN_API_KEY", placement: "header", name: "Authorization", prefix: "Bearer " },
    spec: { kind: "local", path: "appbrain.openapi.yaml" },
  },
  {
    id: "mobileaction",
    label: "Mobile Action",
    auth: "apiKey",
    requiresAuth: true,
    canUseWithoutAuth: false,
    howToGetAuth: "mobileaction.co -> Settings -> API Key / contact support for enterprise API",
    apiAccess: "Official REST API; key is passed as token=YOUR_API_KEY.",
    researchValue: "App Store and Google Play ASO data: keyword rankings/history, top keywords, metadata, visibility and creatives.",
    needsBotOrUi: false,
    startupTime: "15 min",
    apiKey: {
      envVar: "MOBILE_ACTION_API_KEY",
      placement: "query",
      name: "token",
      checkUrl: "https://api.mobileaction.co/api-key",
    },
    spec: { kind: "local", path: "mobileaction.openapi.yaml" },
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
    needsBotOrUi: false,
    startupTime: "15 min",
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
