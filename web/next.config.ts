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
        // Where the page may send requests (fetch, XHR, WebSocket) and load images
        // from: this site, the two AI providers a visitor can bring a key for, and
        // the map tiles. It narrows where a key could be sent; it is not a full
        // script-src policy (see docs/decisions/DR-004).
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "connect-src 'self' https://api.anthropic.com https://api.openai.com https://tiles.openfreemap.org https://vercel.live",
              "img-src 'self' data: blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/(data|geo)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default nextConfig;
