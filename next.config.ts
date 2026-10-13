import type { NextConfig } from "next";

// Gunakan static export HANYA saat build untuk Android (Capacitor APK).
// Set environment variable CAPACITOR=true saat build APK:
//   CAPACITOR=true npx cap sync
// Untuk Vercel, biarkan normal (tanpa CAPACITOR=true).
const isCapacitorBuild =
  process.env.CAPACITOR === "true" ||
  process.env.npm_lifecycle_event === "build:android";

const nextConfig: NextConfig = {
  ...(isCapacitorBuild && {
    // Static export untuk Capacitor APK bundling.
    output: "export",
    // Trailing slash agar routing benar di WebView Android
    trailingSlash: true,
  }),
  // Nonaktifkan image optimization
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
