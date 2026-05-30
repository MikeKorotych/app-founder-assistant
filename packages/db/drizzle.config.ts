import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` reads this to emit SQL migrations into ./migrations.
// The Worker applies them via `wrangler d1 migrations apply DB`.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
