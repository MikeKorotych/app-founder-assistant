/**
 * Capterra / Gartner Digital Markets API — hand-written contract.
 *
 * No public self-serve API reference exists; access is gated (key from your
 * account manager). These types are modelled from integration-vendor docs and
 * the public conversion-tracking snippet:
 *   - https://www.capterra.com/legal/ppc-service-description/
 *   - https://docs.hockeystack.com/integrations/ad-platforms/capterra-ads
 *   - https://docs.dreamdata.io/article/xjokkcvg7h-capterra-integration
 *   - https://www.capterra.com/vp/conversion_tracking
 *
 * Two distinct surfaces — do not conflate them.
 */

/* ── 1. Conversion tracking (a client-side JS pixel, NOT a REST API) ── */

/**
 * The public snippet loads `ct.capterra.com/capterra_tracker.js` and only
 * carries `vid` + `vkey`. Any value/currency/order payload is NOT publicly
 * documented — those fields are marked unknown/optional.
 */
export interface ConversionTracker {
  /** Capterra vendor/campaign id (numeric, as a string in the snippet). */
  vid: string;
  /** Capterra vendor key (GUID-like). */
  vkey: string;
  /** Below are NOT confirmed in public docs. */
  conversion_type?: string;
  value?: number;
  currency?: string;
  order_id?: string;
}

/* ── 2. Click Report API (the actual REST API) ── */

/** Base URL: https://public-api.capterra.com/v1 */
export interface ClicksParams {
  /** Required — issued by your account manager. */
  apiKey: string;
  /** Pagination cursor; keep requesting while one is returned. */
  scroll_id?: string;
}

/**
 * `GET /clicks` — historical click data by category, country and channel.
 * Confirmed metric fields below; `cost` currency and exact casing are unknown.
 */
export interface ClickRecord {
  category: string;
  country: string;
  channel: string;
  date: string;
  clicks: number;
  cost: number;
  conversions: number;
  avg_position: number;
}

export interface ClicksResponse {
  /** Present until the last page. */
  scroll_id?: string;
  clicks: ClickRecord[];
}

/**
 * Reviews / leads delivery API: no public endpoint documentation exists.
 * Third parties only offer scrapers, not an official Capterra REST API.
 */
export type ReviewsApi = never;
