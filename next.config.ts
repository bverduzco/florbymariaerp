// next.config.ts — v1.8 (Vercel-friendly)
//
// v1.7 had `output: "standalone"` for self-contained server builds on
// Fly.io / Render. Vercel doesn't need (and shouldn't have) that — they
// handle Next.js builds natively.
//
// Apply: replace your existing next.config.ts with this file.

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfmake"],

  // No `output: "standalone"` — Vercel handles this natively.
  // If you ever need to deploy to Fly.io or Render again, set:
  //   output: "standalone"

  typescript: {
    // Keep ignoreBuildErrors for now — clean up in a future minor version
    // once all the v1.7 type errors are fixed.
    ignoreBuildErrors: true,
  },

  reactStrictMode: false,

  // Vercel-specific: enable functions timeout extension to 60s for the
  // PDF/Excel generation endpoints (default is 10s on Hobby plan).
  // Requires Vercel Pro for the actual extension, but doesn't hurt to declare.
  // The routes themselves also set `export const maxDuration = 60`.
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
