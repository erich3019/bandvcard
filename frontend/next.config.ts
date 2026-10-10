import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // For `npm run dev` without nginx: forward API calls to the backend.
  // Behind nginx this is never reached, because nginx routes /api itself.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://localhost:5048"}/api/:path*`,
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
