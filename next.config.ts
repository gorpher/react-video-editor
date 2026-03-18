import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["express", "@genkit-ai/core", "genkit"],
  experimental: {
    turbopackSourceMaps: false,
  },
};

export default nextConfig;
