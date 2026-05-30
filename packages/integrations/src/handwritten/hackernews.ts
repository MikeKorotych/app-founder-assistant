/**
 * Hacker News — hand-written contract.
 *
 * Two free, zero-auth APIs:
 *   - Official Firebase API (items, lists, users):
 *     https://github.com/HackerNews/API  ·  base https://hacker-news.firebaseio.com/v0
 *   - Algolia HN Search (full-text keyword/date search — the practical path):
 *     https://hn.algolia.com/api  ·  base https://hn.algolia.com/api/v1
 *
 * No key, no account. Great for startup/tech pain points & sentiment.
 */

/* ── Official Firebase API ── */

export type ItemType = "story" | "comment" | "job" | "poll" | "pollopt";

export interface Item {
  id: number;
  type: ItemType;
  by?: string;
  /** Unix seconds. */
  time?: number;
  text?: string;
  /** Story/poll title. */
  title?: string;
  /** Story URL. */
  url?: string;
  score?: number;
  /** Comment/pollopt parent id. */
  parent?: number;
  /** Child comment / pollopt ids. */
  kids?: number[];
  /** Total comment count (stories/polls). */
  descendants?: number;
  dead?: boolean;
  deleted?: boolean;
}

export interface User {
  id: string;
  /** Unix seconds. */
  created: number;
  karma: number;
  about?: string;
  /** Ids of items the user submitted. */
  submitted?: number[];
}

/** GET /v0/{top|new|best|ask|show|job}stories.json → item ids. */
export type StoryIds = number[];

/* ── Algolia HN Search ── */

export interface SearchParams {
  /** Full-text query. */
  query?: string;
  /** Filter, e.g. "story", "comment", "(story,poll)", "author_pg", "story_123". */
  tags?: string;
  /** Numeric filters, e.g. "points>100,created_at_i>1700000000". */
  numericFilters?: string;
  /** 0-based. */
  page?: number;
  hitsPerPage?: number;
}

export interface SearchHit {
  objectID: string;
  title?: string;
  url?: string;
  author: string;
  points?: number;
  story_text?: string;
  comment_text?: string;
  num_comments?: number;
  created_at: string;
  created_at_i: number;
  /** Matched tags, e.g. ["story","author_x","story_123"]. */
  _tags: string[];
}

/** GET /v1/search (relevance) or /v1/search_by_date (recency). */
export interface SearchResponse {
  hits: SearchHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  processingTimeMS: number;
  query: string;
}
