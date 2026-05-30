/**
 * Kickstarter API — hand-written contract.
 *
 * Kickstarter has NO official public API. These types are reverse-engineered
 * from the website's own internal JSON calls (kickscraper, Apify actors). They
 * are undocumented, anti-bot-protected, and can change without notice.
 *   - https://github.com/markolson/kickscraper
 *   - https://www.kickstarter.com/discover/advanced?format=json
 *   - append `?format=json` to any project URL
 *
 * Treat everything here as community/undocumented, not an official contract.
 */

export type ProjectState =
  | "live"
  | "successful"
  | "failed"
  | "canceled"
  | "suspended"
  | "started"
  | "submitted";

/** `GET /discover/advanced?format=json` query params. */
export interface DiscoverParams {
  /** Keyword. */
  term?: string;
  category_id?: number;
  page?: number;
  state?: ProjectState;
  sort?: "popular" | "ending-soon" | "recently-launched" | "most-funded" | "magic";
  format?: "json";
}

export interface Creator {
  id: number;
  name: string;
  slug?: string;
  avatar: { thumb: string; small: string; medium: string };
  urls: { web: { user: string } };
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id?: number;
  position?: number;
  color?: number;
  urls: { web: { discover: string } };
}

export interface Location {
  id: number;
  name: string;
  displayable_name: string;
  country: string;
  state?: string;
  type?: string;
  slug: string;
  urls: { web: { location: string } };
}

export interface Photo {
  key?: string;
  full: string;
  ed: string;
  med: string;
  little: string;
  small: string;
  thumb: string;
  "1024x576": string;
  "1536x864": string;
}

/** The raw Kickstarter project object. All `*_at`/`deadline` are unix seconds. */
export interface Project {
  id: number;
  name: string;
  blurb: string;
  /** In the project's `currency`. */
  goal: number;
  pledged: number;
  state: ProjectState;
  slug: string;
  country: string;
  country_displayable_name: string;
  currency: string;
  currency_symbol: string;
  currency_trailing_code: boolean;
  /** Unix epoch seconds. */
  deadline: number;
  state_changed_at: number;
  created_at: number;
  launched_at: number;
  backers_count: number;
  static_usd_rate: number;
  /** USD. */
  usd_pledged: number;
  /** In `current_currency`. */
  converted_pledged_amount: number;
  fx_rate: number;
  usd_exchange_rate: number;
  current_currency: string;
  usd_type: string;
  staff_pick: boolean;
  is_starrable: boolean;
  spotlight: boolean;
  disable_communication: boolean;
  creator: Creator;
  category: Category;
  location: Location;
  photo: Photo;
  urls: {
    web: { project: string; rewards: string };
    api: { project: string; comments?: string; updates?: string };
  };
  /** Present but variable. */
  profile?: Record<string, unknown>;
}

/** `GET /discover/advanced?format=json` response. */
export interface DiscoverResponse {
  projects: Project[];
  total_hits: number;
  page: number;
}
