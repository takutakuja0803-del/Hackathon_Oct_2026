import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  experimental: {
    cacheComponents: false,
  },
};

export default nextConfig;
