/**
 * Product Hunt API v2 (GraphQL) — hand-written contract.
 *
 * The API is GraphQL, so there is no OpenAPI doc. These types mirror the
 * official schema:
 *   - https://raw.githubusercontent.com/producthunt/producthunt-api/master/schema.graphql
 *   - https://api.producthunt.com/v2/docs
 *
 * Endpoint: POST https://api.producthunt.com/v2/api/graphql
 * Auth: `Authorization: Bearer <token>` (developer token or OAuth).
 *
 * Note: fields like `reviewsCount`, `productLinks`, and a standalone `Maker`
 * type do NOT exist in the schema — only `reviewsRating: Float!` is review-
 * related, makers are `User`s, and image fields are URL strings (not objects).
 */

/** ISO-8601 UTC timestamp. */
export type DateTime = string;

/** Relay-style connection. */
export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount: number;
}
export interface Edge<T> {
  cursor: string;
  node: T;
}
export interface PageInfo {
  endCursor: string | null;
  startCursor: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Post {
  id: string;
  name: string;
  tagline: string;
  description: string | null;
  slug: string;
  url: string;
  website: string;
  votesCount: number;
  commentsCount: number;
  /** No `reviewsCount` exists — this is the only review field. */
  reviewsRating: number;
  createdAt: DateTime;
  featuredAt: DateTime | null;
  isVoted: boolean;
  isCollected: boolean;
  userId: string;
  /** The hunter. */
  user: User;
  /** Makers are Users; there is no dedicated `Maker` type. */
  makers: User[];
  /** Nullable; a `Media`, not a `{ url }` object. */
  thumbnail: Media | null;
  media: Media[];
  topics: Connection<Topic>;
  comments: Connection<Comment>;
  votes: Connection<Vote>;
  collections: Connection<Collection>;
}

export interface User {
  id: string;
  name: string;
  username: string;
  headline: string | null;
  twitterUsername: string | null;
  websiteUrl: string | null;
  url: string;
  createdAt: DateTime;
  isMaker: boolean;
  isFollowing: boolean;
  isViewer: boolean;
  /** URL string (the schema field takes a `size` arg). */
  profileImage: string | null;
  coverImage: string | null;
  followers: Connection<User>;
  following: Connection<User>;
  submittedPosts: Connection<Post>;
  madePosts: Connection<Post>;
  votedPosts: Connection<Post>;
  followedCollections: Connection<Collection>;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string;
  url: string;
  createdAt: DateTime;
  postsCount: number;
  followersCount: number;
  isFollowing: boolean;
  /** URL string. */
  image: string | null;
}

export interface Comment {
  id: string;
  body: string;
  url: string;
  createdAt: DateTime;
  votesCount: number;
  isVoted: boolean;
  userId: string;
  user: User;
  parentId: string | null;
  parent: Comment | null;
  replies: Connection<Comment>;
  votes: Connection<Vote>;
}

export interface Collection {
  id: string;
  /** `name` is the title; there is no separate `title` field. */
  name: string;
  tagline: string;
  description: string | null;
  url: string;
  createdAt: DateTime;
  featuredAt: DateTime | null;
  followersCount: number;
  isFollowing: boolean;
  userId: string;
  user: User;
  coverImage: string | null;
  /** Use `posts.totalCount` for a post count (no `postsCount` field). */
  posts: Connection<Post>;
  topics: Connection<Topic>;
}

export interface Vote {
  id: string;
  createdAt: DateTime;
  userId: string;
  user: User;
}

export interface Media {
  type: string;
  /** Field takes optional size args; resolves to a URL string. */
  url: string;
  videoUrl: string | null;
}

export type PostsOrder = "FEATURED_AT" | "NEWEST" | "RANKING" | "VOTES";
export type CommentsOrder = "NEWEST" | "VOTES_COUNT";
export type CollectionsOrder = "FEATURED_AT" | "FOLLOWERS_COUNT" | "NEWEST";
export type TopicsOrder = "FOLLOWERS_COUNT" | "NEWEST";

/** Cursor pagination args present on every connection field. */
export interface ConnectionArgs {
  first?: number;
  last?: number;
  after?: string;
  before?: string;
}

/** Root Query arguments. */
export interface QueryArgs {
  post: { id?: string; slug?: string };
  posts: ConnectionArgs & {
    order?: PostsOrder;
    postedAfter?: DateTime;
    postedBefore?: DateTime;
    topic?: string;
    featured?: boolean;
    twitterUrl?: string;
  };
  user: { id?: string; username?: string };
  topic: { id?: string; slug?: string };
  topics: ConnectionArgs & { order?: TopicsOrder; query?: string; followedByUserId?: string };
  comment: { id: string };
  collection: { id?: string; slug?: string };
  collections: ConnectionArgs & {
    order?: CollectionsOrder;
    featured?: boolean;
    postId?: string;
    userId?: string;
  };
}

/** Root Query result fields (nullable where the object may not exist). */
export interface Query {
  post: Post | null;
  posts: Connection<Post>;
  user: User | null;
  topic: Topic | null;
  topics: Connection<Topic>;
  comment: Comment | null;
  collection: Collection | null;
  collections: Connection<Collection>;
  viewer: Viewer | null;
}

export interface Viewer {
  user: User;
}
