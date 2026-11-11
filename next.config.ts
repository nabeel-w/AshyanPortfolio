import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Grainy cinematic stills show artefacts below ~85, so hero/cards request 90.
    qualities: [75, 85, 90],
    // Hosts that media providers serve from (src/features/media/providers).
    remotePatterns: [
      { protocol: "https", hostname: "image.mux.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "customer-*.cloudflarestream.com" },
      { protocol: "https", hostname: "*.r2.dev" },
      ...(process.env.S3_PUBLIC_URL ? [new URL(process.env.S3_PUBLIC_URL)] : []),
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
