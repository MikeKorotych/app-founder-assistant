/**
 * AppTweak API — hand-written contract.
 *
 * AppTweak publishes OpenAPI on its ReadMe portal but the raw spec is bot-gated
 * and not reliably fetchable, so these types are modelled from the per-endpoint
 * reference pages (and the machine index at /llms.txt):
 *   - https://developers.apptweak.com/llms.txt
 *   - https://developers.apptweak.com/reference/<endpoint>.md
 *
 * Base host: https://public-api.apptweak.com
 * Auth: `x-apptweak-key: <API_KEY>` header on every request.
 */

/** `x-apptweak-key: <API_KEY>`. */
export interface AppTweakAuthHeaders {
  "x-apptweak-key": string;
}

export type Device = "iphone" | "ipad" | "android";

/** Every response wraps `result` (keyed by app id / keyword) and `metadata`. */
export interface Envelope<R> {
  result: R;
  metadata: {
    request: {
      path: string;
      params: Record<string, unknown>;
      cost: number;
      max_credit_cost: number;
      status: number;
    };
    response: unknown | null;
  };
}

/** `result` keyed by the requested app id (or keyword). */
export type ByApp<T> = Record<string, T>;

/** Shared params accepting up to 5 comma-separated app ids. */
export interface AppsParams {
  /** Comma-separated app ids, max 5. */
  apps: string;
  /** Default `us`. */
  country?: string;
  language?: string;
  /** Default `iphone`. */
  device?: Device;
}

export interface DateRangeParams {
  /** YYYY-MM-DD, default 30 days ago. */
  start_date?: string;
  /** YYYY-MM-DD, default yesterday. */
  end_date?: string;
}

/* ── App metadata ─────────────────────────────────────────────── */

export interface Screenshot {
  id: number | string;
  filename: string;
  path_component: string;
  url: string;
  hash: string;
}

export interface AppMetadata {
  title: string;
  subtitle: string | null;
  promotional_text: string | null;
  description: string;
  id: string | number;
  categories: (number | string)[];
  icon: string;
  price: string;
  release_date: string;
  screenshots: Record<string, Screenshot[]>;
  videos: Record<
    string,
    { uri: string; audio: boolean; width: number; height: number; codecs: string }[]
  >;
  size: number | { current: { data: number } };
  rating: { average: number };
  developer: { id: string | number; name: string; email: string; website: string };
  versions: {
    version: string;
    release_notes: string;
    release_date: string;
    has_game_center: boolean;
    game_controller_information: Record<string, unknown>;
  }[];
  customers_also_bought: string[];
  similar_apps: string[];
  dna: { class_id: number; class_label: string; subclass_id: number; subclass_label: string };
  features: { game_center: boolean; passbook: boolean; in_apps: boolean };
  in_app_purchases: {
    id: number;
    name: string;
    price: { value: string; currency: string };
    is_subscription: boolean;
  }[];
  permissions: string[];
}

/** `GET /api/public/store/apps/metadata.json` */
export type MetadataResponse = Envelope<ByApp<{ metadata: AppMetadata }>>;

export interface MetadataChange {
  target: string;
  old_value: string | number | Record<string, unknown>;
  new_value: string | number | Record<string, unknown>;
  old_release_notes?: string;
  new_release_notes?: string;
  version: string;
  is_ab_test: boolean | null;
  date: string;
}

/** `GET /api/public/store/apps/metadata/changes.json` */
export type MetadataHistoryResponse = Envelope<ByApp<{ changes: MetadataChange[] }>>;

/* ── App metrics ──────────────────────────────────────────────── */

export type Metric = "downloads" | "revenues" | "ratings" | "daily-ratings" | "app-power";

export interface MetricsParams extends AppsParams {
  /** Required, comma-separated subset of {@link Metric}. */
  metrics: string;
}

interface RatingBreakdown {
  "1": number;
  "2": number;
  "3": number;
  "4": number;
  "5": number;
  total: number;
  avg: number;
}

export interface MetricsCurrent {
  downloads?: { value: number; date: string; precision: number };
  revenues?: { value: number; date: string; precision: number; currency: string };
  ratings?: { value: number; date: string; breakdown: RatingBreakdown };
  "daily-ratings"?: {
    value: number;
    date: string;
    breakdown: Record<"1" | "2" | "3" | "4" | "5", number>;
  };
  "app-power"?: { value: number; date: string };
}

/** `GET /api/public/store/apps/metrics/current.json` */
export type MetricsCurrentResponse = Envelope<ByApp<MetricsCurrent>>;

/** History returns arrays of the same per-metric objects. */
export interface MetricsHistory {
  downloads?: { value: number; date: string; precision: number }[];
  revenues?: { value: number; date: string; precision: number; currency: string }[];
  ratings?: { value: number; date: string; breakdown: RatingBreakdown }[];
  "daily-ratings"?: {
    value: number;
    date: string;
    breakdown: Record<"1" | "2" | "3" | "4" | "5", number>;
  }[];
  "app-power"?: { value: number; date: string }[];
}

/** `GET /api/public/store/apps/metrics/history.json` */
export type MetricsHistoryResponse = Envelope<ByApp<MetricsHistory>>;

/* ── Category rankings ────────────────────────────────────────── */

export interface CategoryRankCurrent {
  value: number;
  date: string;
  category: string | null;
  category_name: string | null;
  chart_type: string;
  fetch_depth: number | null;
}

/** `GET /api/public/store/apps/category-rankings/current.json` */
export type CategoryRankingCurrentResponse = Envelope<ByApp<{ ranking: CategoryRankCurrent[] }>>;

export interface CategoryRankHistory {
  date: string;
  value: {
    rank: number;
    fetch_date: string;
    category: string;
    category_name: string;
    chart_type: string;
    fetch_depth: number;
  }[];
}

/** `GET /api/public/store/apps/category-rankings/history.json` */
export type CategoryRankingHistoryResponse = Envelope<ByApp<{ rankings: CategoryRankHistory[] }>>;

/* ── Reviews ──────────────────────────────────────────────────── */

export interface ReviewsSearchParams extends AppsParams, DateRangeParams {
  /** Default `android` for this endpoint. */
  device?: Device;
  /** Max 500, default 10. */
  limit?: number;
  /** Default 0. */
  offset?: number;
  /** Search term within the review body. */
  term?: string;
  replied?: "true" | "false" | "nil";
}

export interface Review {
  country: string;
  application_id: string;
  date: string;
  rating: number;
  title: string;
  body: string;
  body_length: number;
  vote_count: number;
  vote_sum: number;
  is_edited: boolean;
  id: string;
  author: { name: string; type: string; id: number; photo?: string; profile?: string };
  response: { date: string; body: string } | null;
  /** Android only. */
  version?: string;
  language?: string;
}

/** `GET /api/public/store/apps/reviews/search.json` */
export type ReviewsSearchResponse = Envelope<ByApp<{ reviews: Review[] }>>;

interface ReviewStatBucket {
  total: number;
  average: number;
  count: Record<"1" | "2" | "3" | "4" | "5", number>;
}

/** `GET /api/public/store/apps/reviews/stats.json` */
export type ReviewsStatsResponse = Envelope<
  ByApp<{
    reviews: { daily: { date: string; value: ReviewStatBucket }[]; aggregate: ReviewStatBucket };
  }>
>;

/* ── Paid keywords / share of voice ───────────────────────────── */

export interface PaidKeywordsParams extends AppsParams, DateRangeParams {
  /** When true, returns `{ keyword, count }` instead of dated rows. */
  aggregated?: boolean;
}

/** `GET /api/public/store/apps/keywords/bids.json` */
export type PaidKeywordsResponse = Envelope<
  ByApp<{ bids: ({ keyword: string; count: number } | { date: string; keyword: string })[] }>
>;

export interface ShareOfVoiceParams extends DateRangeParams {
  /** Comma-separated keywords, max 5. */
  keywords: string;
  country?: string;
  language?: string;
  device?: Device;
}

/** `GET /api/public/store/keywords/apps/bids.json` (keyed by keyword). */
export type ShareOfVoiceResponse = Envelope<
  Record<string, { bids: { app_id: string; date_occurrences: string[]; percent_sov: number }[] }>
>;
