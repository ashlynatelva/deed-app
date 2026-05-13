import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to serve HMR + /_next/* assets to requests
  // originating from this LAN IP. Without this, Next 16 blocks
  // cross-origin dev resources, which prevents the client bundle from
  // hydrating on a phone that hits the desktop's IP rather than localhost.
  // The error surfaced as:
  //   "Blocked cross-origin request to Next.js dev resource
  //    /_next/webpack-hmr from 192.168.1.7"
  // Production builds ignore this — it's a dev-only allow-list.
  allowedDevOrigins: ["192.168.1.7"],
};

export default nextConfig;
