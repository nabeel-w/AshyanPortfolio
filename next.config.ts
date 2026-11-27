import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/google6e837a6fdc8bc1b5.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Grainy cinematic stills show artefacts below ~85, so hero/cards request 90.
    qualities: [75, 85, 90],
    // Hosts that media providers serve from (src/features/media/providers).
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // YouTube thumbnails (admin previews; fallback poster). Films themselves play in the nocookie embed.
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "motion"],
    // A restored build cache (Vercel keeps .next/cache) served a stale globals.css: the Tailwind loader
    // does not invalidate under it. Compiling takes ~7 s, so correctness wins. docs/08.
    turbopackFileSystemCacheForBuild: false,
  },
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
