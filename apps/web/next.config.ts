import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:8787";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hahaton/ui", "@hahaton/contracts"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
