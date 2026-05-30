/**
 * Bluesky (AT Protocol) — hand-written contract.
 *
 * Free, open API — no key for public reads; `searchPosts` needs a free app
 * password. AT Protocol ships Lexicon schemas (not OpenAPI), so these types are
 * modelled from the app.bsky lexicons:
 *   - https://docs.bsky.app/docs/api/app-bsky-feed-search-posts
 *   - https://docs.bsky.app/docs/api/app-bsky-feed-get-author-feed
 *
 * Public AppView base: https://public.api.bsky.app/xrpc
 * Auth: none for most reads; searchPosts → Bearer access JWT from
 *       com.atproto.server.createSession (identifier + app password).
 */

/** Profile as embedded in feed/post views. */
export interface ProfileViewBasic {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  /** Viewer-relative state (only when authed). */
  viewer?: { muted?: boolean; blockedBy?: boolean; following?: string; followedBy?: string };
  labels?: Label[];
  createdAt?: string;
}

export interface Label {
  src: string;
  uri: string;
  val: string;
  cts: string;
  neg?: boolean;
}

/** The post record itself (app.bsky.feed.post). */
export interface PostRecord {
  $type: "app.bsky.feed.post";
  text: string;
  createdAt: string;
  langs?: string[];
  reply?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } };
  embed?: Record<string, unknown>;
  tags?: string[];
}

/** A hydrated post (app.bsky.feed.defs#postView). */
export interface PostView {
  uri: string;
  cid: string;
  author: ProfileViewBasic;
  record: PostRecord;
  embed?: Record<string, unknown>;
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  quoteCount?: number;
  indexedAt: string;
  labels?: Label[];
  viewer?: { repost?: string; like?: string; threadMuted?: boolean };
}

/** GET /xrpc/app.bsky.feed.searchPosts */
export interface SearchPostsParams {
  /** Required search query. */
  q: string;
  /** `top` | `latest`. */
  sort?: "top" | "latest";
  /** ISO datetime lower bound. */
  since?: string;
  until?: string;
  /** Restrict to posts mentioning / by this actor (DID or handle). */
  mentions?: string;
  author?: string;
  lang?: string;
  domain?: string;
  url?: string;
  tag?: string[];
  /** 1–100, default 25. */
  limit?: number;
  cursor?: string;
}
export interface SearchPostsResponse {
  cursor?: string;
  /** Approximate total hits, when available. */
  hitsTotal?: number;
  posts: PostView[];
}

/** Items in an author feed; a post plus optional repost/reply context. */
export interface FeedViewPost {
  post: PostView;
  reply?: { root: PostView; parent: PostView };
  reason?: { $type: string; by: ProfileViewBasic; indexedAt: string };
}

/** GET /xrpc/app.bsky.feed.getAuthorFeed */
export interface GetAuthorFeedParams {
  /** DID or handle. */
  actor: string;
  /** 1–100, default 50. */
  limit?: number;
  cursor?: string;
  /** Server-side filter on what the feed includes. */
  filter?:
    | "posts_with_replies"
    | "posts_no_replies"
    | "posts_with_media"
    | "posts_and_author_threads";
}
export interface GetAuthorFeedResponse {
  cursor?: string;
  feed: FeedViewPost[];
}

/** POST /xrpc/com.atproto.server.createSession (to get an access JWT). */
export interface CreateSessionParams {
  /** Handle or DID. */
  identifier: string;
  /** App password. */
  password: string;
}
export interface CreateSessionResponse {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}
