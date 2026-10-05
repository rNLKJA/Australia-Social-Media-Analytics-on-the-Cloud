import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The read-only analytics database is read at runtime by the records pages
  // and CSV exports; make sure it ships with every server function.
  outputFileTracingIncludes: {
    "/": ["./data/analytics.db"],
    "/**": ["./data/analytics.db"],
  },
  async headers() {
    return [
      {
        source: "/(data|geo)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
