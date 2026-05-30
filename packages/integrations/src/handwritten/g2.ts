/**
 * G2 API (via RapidAPI) — hand-written contract.
 *
 * The official G2 partner API is private. The public surface is the RapidAPI
 * "G2 Products, Reviews & Users" (G2Scraper) listing; these types are taken
 * from its published OpenAPI 3.0 definition:
 *   - https://rapidapi.com/G2Scraper/api/g2-products-reviews-users2
 *   - https://github.com/biegehydra/Advanced-G2-Scraper
 *
 * Auth: RapidAPI headers on every request.
 */

export interface RapidApiHeaders {
  "X-RapidAPI-Key": string;
  /** e.g. `g2-products-reviews-users2.p.rapidapi.com`. */
  "X-RapidAPI-Host": string;
}

/** Every G2Scraper response is wrapped in this envelope. */
export interface Envelope<T> {
  statusCode: number;
  message: string;
  success: boolean;
  data: T;
}

/** `GET /product/{slug}` and `/product/{slug}/competitors`. */
export interface Product {
  id: number;
  slug: string;
  name: string;
  vendorId: number;
  vendorSlug: string;
  /** = review_count. */
  numReviews: number;
  description: string;
  lastUpdated: string;
  /** = logo. */
  thumbImageUrl: string;
}

/** `GET /vendor/{slug}`. */
export interface Vendor {
  id: number;
  slug: string;
  name: string;
  averageRating: number;
  foundedYear: number;
  ownership: string;
  description: string;
  hqLocation: string;
  phone: string;
  linkedinUrl: string;
  twitterHandle: string;
  overviewProvidedBy: string;
  revenue: number;
  revenueUnit: string;
  numProducts: number;
  numCategories: number;
  numReviews: number;
  lastUpdated: string;
}

/** `GET /user/{id}`. */
export interface User {
  id: string;
  name: string;
  signUpDate: string;
  linkedinUrl: string;
  twitterUrl: string;
  title: string;
  company: string;
  companySize: string;
  lastUpdated: string;
}

/**
 * `GET /product/{id}/reviews` and `/user/{id}/reviews`.
 * G2 reviews are structured (like/dislike/problemBenefit), not title+body.
 */
export interface SurveyResponse {
  id: number;
  productId: number;
  productSlug: string;
  userId: string;
  /** = rating. */
  starRating: number;
  /** = pros. */
  like: string;
  /** = cons. */
  dislike: string;
  problemBenefit: string;
  recommendations: string;
  videoReview: boolean;
  reviewSource: string;
  incentivizedReview: boolean;
  validatedReviewer: boolean;
  verifiedCustomer: boolean;
  /** = date. */
  published: string;
  vendorId: number;
  vendorSlug: string;
  lastUpdated: string;
  /** = reviewer. */
  user: User;
}

/** `GET /autocomplete?Query=...` (nested DTO item shapes are not published). */
export interface Autocomplete {
  query: string;
  products: unknown[];
  vendors: unknown[];
  categories: unknown[];
}

export interface ReviewsParams {
  page?: number;
  starRating?: number;
  /** Default `g2_default`. */
  sortOrder?: string;
}

export type AutocompleteResponse = Envelope<Autocomplete>;
export type ProductResponse = Envelope<Product>;
export type CompetitorsResponse = Envelope<Product[]>;
export type ProductReviewsResponse = Envelope<SurveyResponse[]>;
export type VendorResponse = Envelope<Vendor>;
export type VendorProductsResponse = Envelope<Product[]>;
export type UserResponse = Envelope<User>;
export type UserProductsResponse = Envelope<
  { userId: string; productId: number; productSlug: string }[]
>;
export type UserReviewsResponse = Envelope<SurveyResponse[]>;
