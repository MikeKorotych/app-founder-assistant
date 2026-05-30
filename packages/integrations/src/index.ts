/**
 * @hahaton/integrations — contracts for every external API we pull from.
 *
 * Exports the source registry and auth strategy types. The generated OpenAPI
 * types live behind a separate entry point (`@hahaton/integrations/generated`)
 * because they're produced by `pnpm generate:contracts` and git-ignored.
 */
export * from "./sources.js";
export * from "./auth.js";
