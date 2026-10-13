import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export untuk Capacitor APK bundling.
  // Semua halaman dirender jadi HTML/JS/CSS statis di folder `out/`.
  output: 'export',
  // Nonaktifkan image optimization (tidak kompatibel dengan static export)
  images: {
    unoptimized: true,
  },
  // Trailing slash agar routing benar di WebView Android
  trailingSlash: true,
};

export default nextConfig;
