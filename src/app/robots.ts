import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";

/** Search + AI crawlers are welcome on the public site (GEO); admin/API never. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/login", "/preview"] },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
