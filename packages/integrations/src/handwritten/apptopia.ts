/**
 * Apptopia Data API — hand-written contract.
 *
 * Docs are a Slate (Markdown) site with no OpenAPI; these types are modelled
 * from the documented attribute tables and example payloads at:
 *   - https://dev.apptopia.com/
 *   - https://help.apptopia.com/knowledge/does-apptopia-provide-an-api
 *
 * Base host: https://integrations.apptopia.com
 * Auth: a JWT obtained from `POST /api/login`, sent bare (no scheme) as
 *       `Authorization: <token>` on every request.
 *
 * Field NAMES match the documented attribute tables; a few nested shapes are
 * inferred from example JSON and flagged inline.
 */

export type Store = "google_play" | "itunes_connect" | "xiaomi" | "mobile_360" | "tencent";

/** iTunes ids are numeric; other stores use package-name strings. */
export type AppId = string | number;

/** `POST /api/login` (form-encoded). */
export interface LoginParams {
  client: string;
  secret: string;
}
export interface LoginResponse {
  token: string;
}

/** Shared lookup params: a single `id` or repeated `id[]` (max 50). */
export interface IdParams {
  id?: AppId;
  "id[]"?: AppId[];
}

/** Time-series params (range ≤ 180 days, ISO YYYY-MM-DD). */
export interface TimeSeriesParams {
  country_iso: string;
  date_from: string;
  date_to: string;
  /** `v2.0` (default) | `v3.0`. */
  model_version?: "v2.0" | "v3.0";
}

export interface App {
  id: string;
  name: string;
  description: string;
  category_id: number;
  subcategory_id: number;
  category_name: string;
  subcategory_name: string;
  category_ids: number[];
  price_cents: number;
  offers_in_app_purchases: boolean;
  app_store_url: string;
  publisher_name: string;
  publisher_id: number;
  publisher_url: string;
  initial_release_date: string;
  current_version: string;
  last_update_date: string;
  /** iTunes only. */
  approx_size_bytes?: number;
  icon_url: string;
  screenshot_urls: string[];
  other_stores: { store: string; id: AppId }[];
  bundle_id: string;
  permissions: string[];
  apptopia_url: string;
  privacy_url: string;
}

export interface Publisher {
  id: number;
  name: string;
  profile_url: string;
  website_url: string;
  hq_country: string;
  app_ids: number[];
  other_stores: { store: string; id: number }[];
  apptopia_url: string;
  contacts: { company: Record<string, string>; employees: Record<string, unknown>[] };
}

export interface Sdk {
  id: number;
  name: string;
  company: string;
  url: string;
  function: string;
  other_stores: { store: string; id: number }[];
}

export interface Tag {
  id: string;
  name: string;
  types: Record<string, string>;
  status: string;
  category: "games" | "non-games" | "both";
  description: string;
}

/** `GET /api/:store/estimates` and `/publisher_estimates`. */
export interface Estimate {
  id: AppId;
  country_iso: string;
  date: string;
  downloads: number;
  downloads_revenue: number;
  iap_revenue: number;
  total_revenue: number;
  dau: number;
  mau: number;
  arpu: number;
  engagement: number;
}

/** `GET /api/:store/app_sessions`. */
export interface AppSession {
  id: string;
  country_iso: string;
  date: string;
  sessions: number;
  session_len: number;
}

/** `GET /api/:store/ratings`. */
export interface Rating {
  id: string;
  country_iso: string;
  date: string;
  avg_rating: number;
  ratings_count: number;
  ratings_breakdown: Record<"1" | "2" | "3" | "4" | "5", number>;
  /** iTunes only. */
  current_version_avg_rating?: number;
  current_version_ratings_count?: number;
  current_version_ratings_breakdown?: Record<"1" | "2" | "3" | "4" | "5", number>;
}

/** Sentiment/intent bucket for `GET /api/:store/reviews/summary`. */
export interface ReviewBucket {
  app_id: string;
  analyzed_reviews: number;
  overall_sentiment: number;
  sentiments: { positive: number; negative: number; mixed: number; neutral: number };
  intents: {
    service: number;
    performance_and_bugs: number;
    payment: number;
    support: number;
    login: number;
    feature_request: number;
    notifications: number;
    design: number;
  };
}
export interface ReviewsSummaryResponse {
  summary: ReviewBucket[];
  time_series: (ReviewBucket & { date: string })[];
}

/** Rank object keyed by category id (shape inferred from example JSON). */
export interface AppRank {
  id: string;
  country_iso: string;
  date: string;
  ranks: Record<string, { grossing?: number; paid?: number; free?: number }>;
}

/** `GET /api/:store/rank_lists` (top charts). */
export interface RankList {
  date: string;
  country_iso: string;
  kind: "free" | "paid" | "grossing";
  category_id: number;
  app_ids: AppId[];
}

/** `GET /api/:store/app_graph` (cross-app usage). */
export interface AppGraphEdge {
  app_id: string;
  related_app_id: string;
  /** Legacy weight. */
  weight: number;
  /** Normalised similarity 0–1. */
  weight_sim: number;
}

/** `GET /api/:store/app_retention`. */
export interface AppRetention {
  id: string;
  date: string;
  country_iso: string;
  d1_retention: number;
  d7_retention: number;
  d30_retention: number;
}

/** `GET /api/:store/app_demographics`. */
export interface AppDemographics {
  id: string;
  date: string;
  country_iso: string;
  pct_male: number;
  pct_female: number;
  age_10_20: number;
  age_21_30: number;
  age_31_40: number;
  age_41_50: number;
  age_51_plus: number;
}

/** Bulk-iteration envelope returned by every discovery endpoint. */
export interface DiscoveryResponse<T> {
  result_rows: T[];
  next_page_token: string;
}
export interface DiscoveryParams {
  /** 100–10000. */
  total_partitions: number;
  partition: number;
  page_token?: string;
}

/** `POST /api/app_search` — nested-array query, see docs. */
export type SearchQuery = unknown[];
export interface AppSearchResponse {
  app_ids: { google_play: string[]; itunes_connect: number[] };
}

/** `GET /api/:store/data_dumps` → presigned S3 parts (~24h TTL). */
export interface DataDump {
  date: string;
  part: number;
  url: string;
}
