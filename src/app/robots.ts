import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";

const PRIVATE = ["/admin", "/api", "/login", "/preview"];

/**
 * Client decision (issue #1): search engines AND AI crawlers are welcome on the public site (GEO);
 * private areas are off-limits to everyone. AI agents are listed explicitly so the policy is unambiguous.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
