/**
 * data.ai (formerly App Annie, now Sensor Tower) Intelligence API —
 * hand-written contract.
 *
 * No OpenAPI doc; the official help-center articles are login-gated. Endpoint
 * paths and request params are grounded in the webhue/appannie Python client;
 * response field names in the a8t3r/appannie-client Java models. Items not
 * confirmed by either client are marked `unknown`/inferred.
 *   - https://helpcenter.data.ai/community/s/article/API-Introduction
 *   - https://github.com/webhue/appannie
 *   - https://github.com/a8t3r/appannie-client
 *
 * Base URL: https://api.data.ai/v1.3/   (all endpoints are GET)
 * Auth: `Authorization: Bearer <API_KEY>` + `Accept: application/json`.
 */

export type Market =
  | "ios"
  | "mac"
  | "google-play"
  | "amazon-appstore"
  | "windows-phone"
  | "windows-store"
  | "all-android";

export type DeviceCode = "iphone" | "ipad" | "mac" | "android" | "x86" | "x64" | "arm";
export type Feed = "free" | "paid" | "grossing" | "new_rising";
export type Granularity = "daily" | "weekly" | "monthly";

/** Shared response envelope. */
export interface BasicResponse {
  code: number;
  /** Present on errors. */
  error?: string;
}
/** Adds cursor pagination fields. */
export interface PageableResponse extends BasicResponse {
  page_num: number;
  /** 0-based current page index. */
  page_index: number;
  prev_page: string | null;
  next_page: string | null;
}

/** `GET /v1.3/accounts`. */
export interface Account {
  account_id: number;
  account_name: string;
  account_status: string;
  market: string;
  vertical: string;
  publisher_name: string;
  first_sales_date: string;
  last_sales_date: string;
}
export interface AccountsResponse extends PageableResponse {
  accounts: Account[];
}

/** `GET /v1.3/accounts/{account_id}/products`. */
export interface Product {
  product_id: number;
  product_name: string;
  devices: string[];
  device_codes: string[];
  icon: string;
  status: boolean;
  first_sales_date: string;
  last_sales_date: string;
  market: string;
}
export interface ProductsResponse extends PageableResponse {
  products: Product[];
}

/** `GET /v1.3/apps/{market}/app/{product_id}/details`. */
export interface ProductDetail {
  vertical: string;
  market: string;
  product_id: number;
  product_code: string;
  product_name: string;
  bundle_id: string;
  publisher_id: number;
  publisher_name: string;
  icon: string;
  description: string;
  current_version: string;
  release_date: string;
  last_update: string;
  unpublished: boolean;
  price: number;
  has_iap: boolean;
  size: string;
  languages: string[];
  main_category: string;
  other_categories: string[];
  main_category_path: string[];
  other_category_paths: string[][];
  product_type: string;
  supported_device_list: string[];
}
export interface ProductDetailResponse extends BasicResponse {
  product: ProductDetail;
}

export interface RanksParams {
  start_date: string;
  end_date: string;
  /** `+`/`,`-joined, uppercased. */
  countries?: string;
  /** `+`-joined. */
  categories?: string;
  device?: DeviceCode;
  feeds?: string;
  granularity?: Granularity;
  page_index?: number;
}
/** `GET /v1.3/apps/{market}/app/{product_id}/ranks`. */
export interface ProductRank {
  country: string;
  category: string;
  feed: Feed;
  interval: "hourly" | "daily" | "monthly";
  /** Map of date → rank. */
  ranks: Record<string, number>;
}
export interface ProductRanksResponse extends PageableResponse {
  product_name: string;
  device: string;
  update_time: Record<string, string>;
  product_ranks: ProductRank[];
}

interface RatingEntry {
  average: number;
  rating_count: number;
  star_5_count: number;
  star_4_count: number;
  star_3_count: number;
  star_2_count: number;
  star_1_count: number;
}
/** `GET /v1.3/apps/{market}/app/{product_id}/ratings`. */
export interface Rating {
  country: string;
  all_ratings: RatingEntry;
  current_ratings: RatingEntry;
}
export interface RatingsResponse extends PageableResponse {
  product_name: string;
  ratings: Rating[];
}

/** Your-own-apps ground-truth sales: `/accounts/{account_id}/products/{product_id}/sales`. */
export interface SalesParams {
  start_date?: string;
  end_date?: string;
  countries?: string;
  granularity?: Granularity;
  break_down?: string;
  page_index?: number;
}
export interface ProductUnit {
  downloads: number;
  updates: number;
  refunds: number;
  promotions: number;
  net_downloads: number;
  borrowed_downloads: number;
  free_downloads: number;
  beta_units: number;
  trial_units: number;
}
/** Revenue amounts are returned as strings. */
export interface ProductRevenue {
  downloads: string;
  updates: string;
  refunds: string;
  promotions: string;
  net_downloads: string;
  trial_upgrade_revenue: string;
}
export interface ProductSale {
  date: string;
  country: string;
  units: { product: ProductUnit; iap: Record<string, unknown> };
  revenue: { product: ProductRevenue; iap: Record<string, unknown>; ad: string };
}
export interface ProductSalesResponse extends PageableResponse {
  currency: string;
  vertical: string;
  market: string;
  sales_list: ProductSale[];
  iap_sales_list: ProductSale[];
}

/** Market-intelligence estimates (any app). Item fields are not exposed by the
 * client libraries — modelled loosely. `GET /v1.3/intelligence/apps/{market}/app/{product_id}/history`. */
export interface AppHistoryParams {
  countries: string;
  feeds: string;
  categories?: string;
  device?: DeviceCode;
  granularity?: Granularity;
  start_date?: string;
  end_date?: string;
  page_index?: number;
}
export interface EstimateRow {
  date?: string;
  country?: string;
  downloads?: number;
  revenue?: number;
  [field: string]: unknown;
}
export interface AppHistoryResponse extends PageableResponse {
  list: EstimateRow[];
}

/** `GET /v1.3/intelligence/apps/{market}/app/{product_id}/usage-history`. */
export interface UsageParams {
  countries: string;
  granularity?: Granularity;
  start_date?: string;
  end_date?: string;
  device?: DeviceCode;
  page_index?: number;
}
export interface UsageRow {
  device: string;
  date: string;
  active_users: number;
}
export interface UsageHistoryResponse extends PageableResponse {
  list: UsageRow[];
}

/* ── Metadata / reference endpoints ───────────────────────────── */

/** `GET /v1.3/meta/countries`. */
export interface Country {
  country_code: string;
  country_name: string;
}
/** `GET /v1.3/meta/apps/{market}/devices`. */
export interface DeviceMeta {
  device_code: string;
  device_name: string;
}
/** `GET /v1.3/meta/apps/{market}/feeds`. */
export interface FeedMeta {
  feed_code: string;
  feed_name: string;
}
