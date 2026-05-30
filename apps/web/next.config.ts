import type { NextConfig } from "next";

// /api/* is proxied to the API Worker by app/api/[...path]/route.ts — external
// rewrites aren't proxied by OpenNext on Cloudflare Workers, so we don't use
// next.config rewrites here.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hahaton/ui", "@hahaton/contracts"],
};

export default nextConfig;
