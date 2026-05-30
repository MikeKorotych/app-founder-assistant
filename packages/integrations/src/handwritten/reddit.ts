/**
 * Reddit API — hand-written contract.
 *
 * Reddit publishes no OpenAPI doc; these types are modelled on the official
 * archived API docs (the canonical source of the Thing/Listing data model):
 *   - https://github.com/reddit-archive/reddit/wiki/JSON
 *   - https://github.com/reddit-archive/reddit/wiki/OAuth2
 *   - https://github.com/reddit-archive/reddit/wiki/API
 *   - https://www.reddit.com/dev/api
 *
 * Auth: OAuth2 bearer (`Authorization: bearer <token>`) against
 * https://oauth.reddit.com, plus a required descriptive `User-Agent`.
 */

/** `Authorization: bearer <token>` + a unique descriptive User-Agent. */
export interface RedditAuthHeaders {
  Authorization: `bearer ${string}`;
  /** e.g. `platform:app-id:v1.2.3 (by /u/username)` — required, never spoof. */
  "User-Agent": string;
}

/** Fullname prefixes: t1=Comment, t2=Account, t3=Link, t4=Message, t5=Subreddit, t6=Award. */
export type ThingKind = "t1" | "t2" | "t3" | "t4" | "t5" | "t6";

/** A Reddit object: a `kind` discriminator plus a `data` payload. */
export interface Thing<K extends string, D> {
  kind: K;
  data: D;
}

/** Paginated envelope wrapping a list of Things. */
export interface Listing<T> {
  kind: "Listing";
  data: {
    /** Fullname cursor for the next page (`null` at the end). */
    after: string | null;
    /** Fullname cursor for the previous page. */
    before: string | null;
    modhash: string | null;
    /** Count of children (present on listings, `null` on comment trees). */
    dist: number | null;
    children: T[];
  };
}

/** Truncated branch placeholder in a comment tree. */
export interface More {
  kind: "more";
  data: {
    count: number;
    name: string;
    id: string;
    parent_id: string;
    depth: number;
    /** id36s of the collapsed children, fetch via /api/morechildren. */
    children: string[];
  };
}

/** `t2` — account. `GET /api/v1/me` returns this `data` object un-wrapped. */
export interface Account {
  id: string;
  name: string;
  created: number;
  created_utc: number;
  link_karma: number;
  comment_karma: number;
  /** Present on /me; may be absent elsewhere. */
  total_karma?: number;
  is_gold: boolean;
  is_mod: boolean;
  is_employee?: boolean;
  has_verified_email: boolean;
  has_mail?: boolean | null;
  has_mod_mail?: boolean;
  inbox_count?: number;
  over_18: boolean;
  verified?: boolean;
  /** Avatar URL. */
  icon_img?: string;
  /** Legacy; `null` under OAuth. */
  modhash?: string | null;
}

/** `t3` — link / post. */
export interface Link {
  id: string;
  /** Fullname, e.g. `t3_abc123`. */
  name: string;
  title: string;
  author: string;
  author_flair_text: string | null;
  author_flair_css_class: string | null;
  subreddit: string;
  /** Fullname `t5_...`. */
  subreddit_id: string;
  score: number;
  ups: number;
  /** Present but obfuscated (~0) in the modern API. */
  downs: number;
  num_comments: number;
  created: number;
  created_utc: number;
  url: string;
  /** Path, e.g. `/r/sub/comments/.../`. */
  permalink: string;
  domain: string;
  selftext: string;
  selftext_html: string | null;
  is_self: boolean;
  thumbnail: string;
  media: Record<string, unknown> | null;
  media_embed: Record<string, unknown>;
  over_18: boolean;
  hidden: boolean;
  saved: boolean;
  clicked: boolean;
  locked: boolean;
  stickied: boolean;
  /** "moderator" | "admin" | null. */
  distinguished: string | null;
  link_flair_text: string | null;
  link_flair_css_class: string | null;
  /** true/false/null = upvoted/downvoted/no vote. */
  likes: boolean | null;
  /** `false` if never edited, else an epoch timestamp. */
  edited: number | false;
}

/** `t1` — comment. */
export interface Comment {
  id: string;
  /** Fullname `t1_...`. */
  name: string;
  body: string;
  body_html: string;
  author: string;
  author_flair_text: string | null;
  author_flair_css_class: string | null;
  score: number;
  score_hidden: boolean;
  ups: number;
  gilded: number;
  created: number;
  created_utc: number;
  /** `t1_...` (reply) or `t3_...` (top-level). */
  parent_id: string;
  /** `t3_...`. */
  link_id: string;
  subreddit: string;
  subreddit_id: string;
  distinguished: string | null;
  saved: boolean;
  likes: boolean | null;
  edited: number | false;
  /** `""` when there are no replies, else a nested Listing. */
  replies: Listing<Thing<"t1", Comment> | More> | "";
}

export type AccountThing = Thing<"t2", Account>;
export type LinkThing = Thing<"t3", Link>;
export type CommentThing = Thing<"t1", Comment>;

/** Sort window shared by top/controversial/search. */
export type TimeRange = "hour" | "day" | "week" | "month" | "year" | "all";

/** Common listing pagination params. */
export interface ListingParams {
  /** Default 25, max 100. */
  limit?: number;
  after?: string;
  before?: string;
  count?: number;
  /** `"all"` disables the viewer's filters. */
  show?: "all" | string;
  sr_detail?: boolean;
}

export interface SearchParams extends ListingParams {
  /** Required, max 512 chars. */
  q: string;
  restrict_sr?: boolean;
  sort?: "relevance" | "hot" | "top" | "new" | "comments";
  t?: TimeRange;
  /** Comma-delimited subset of `sr`, `link`, `user`. */
  type?: string;
  category?: string;
  include_facets?: boolean;
}

export interface CommentsParams {
  /** id36 of a comment to focus the thread on. */
  comment?: string;
  context?: number;
  depth?: number;
  limit?: number;
  sort?: "confidence" | "top" | "new" | "controversial" | "old" | "random" | "qa" | "live";
  threaded?: boolean;
  truncate?: number;
  sr_detail?: boolean;
}

/** `GET /api/v1/me/karma`. */
export interface KarmaList {
  kind: "KarmaList";
  data: { sr: string; comment_karma: number; link_karma: number }[];
}

/** `GET /r/{subreddit}/hot|new|top|controversial` → a Listing of posts. */
export type SubredditListingResponse = Listing<LinkThing>;

/**
 * `GET /comments/{article}` → a two-element tuple:
 * `[0]` the post, `[1]` the comment tree.
 */
export type CommentsResponse = [Listing<LinkThing>, Listing<CommentThing | More>];
