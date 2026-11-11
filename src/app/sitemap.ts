import type { MetadataRoute } from "next";
import { getWorkList } from "@/features/content/queries";
import { absoluteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getWorkList();

  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    ...projects.map((p) => ({
      url: absoluteUrl(`/work/${p.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
      images: [p.cover.src.startsWith("http") ? p.cover.src : absoluteUrl(p.cover.src)],
    })),
  ];
}
