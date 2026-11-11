import type { MetadataRoute } from "next";

/** Home-screen / install metadata. Icons come from app/icon.png and app/apple-icon.png (AZ monogram). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ashyan Zafar — Film Editor",
    short_name: "Ashyan Zafar",
    description: "Portfolio of Ashyan Zafar, film editor.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
