/**
 * Hand-written API contracts for sources that publish no fetchable OpenAPI doc.
 *
 * Each module is grounded in the source's real documentation / GraphQL schema /
 * reverse-engineered JSON (see the file header for citations and confidence).
 * These live alongside the generated types but are committed (not git-ignored)
 * because there's nothing to regenerate them from.
 *
 * Namespaced to avoid collisions between common type names (Product, User, …).
 */

export * as apptopia from "./apptopia";
export * as apptweak from "./apptweak";
export * as bluesky from "./bluesky";
export * as capterra from "./capterra";
export * as dataai from "./dataai";
export * as g2 from "./g2";
export * as hackernews from "./hackernews";
export * as kickstarter from "./kickstarter";
export * as producthunt from "./producthunt";
export * as reddit from "./reddit";
