import type { NextConfig } from "next";

// Local development: the backend sends no CORS headers (nginx adds them on the
// servers), so a browser on http://localhost:3000 can't call http://localhost:8080
// directly. Set NEXT_PUBLIC_API_BASE_URL empty and API_PROXY_TARGET to the
// backend: the browser then calls /api/v1/... on this origin and Next forwards
// it server-side, where CORS does not apply. Unset on staging/production.
const proxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // The "export ready" email links to /exports.
  async redirects() {
    return [{ source: "/exports", destination: "/reports/export", permanent: false }];
  },
  async rewrites() {
    if (!proxyTarget) return [];
    return [
      { source: "/api/v1/:path*", destination: `${proxyTarget}/api/v1/:path*` },
      { source: "/health", destination: `${proxyTarget}/health` }, // version label
    ];
  },
};

export default nextConfig;
