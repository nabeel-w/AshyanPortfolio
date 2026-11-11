import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // Grainy cinematic stills show artefacts below ~85, so hero/cards request 90.
    qualities: [75, 85, 90],
    // Add the chosen storage CDN host here (docs/03-asset-storage.md), e.g. image.mux.com, *.public.blob.vercel-storage.com
    remotePatterns: [{ protocol: "https", hostname: "image.mux.com" }],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "motion"],
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
