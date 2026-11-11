import type { MetadataRoute } from "next";
import { homeSections } from "@/content/fallback";
import { absoluteUrl } from "@/lib/site-url";

// TODO(db): read published projects from Prisma (cached + tagged "projects").
export default function sitemap(): MetadataRoute.Sitemap {
  const work = homeSections.find((s) => s.type === "workGrid");
  const projects = work?.type === "workGrid" ? work.data.projects : [];

  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    ...projects.map((p) => ({
      url: absoluteUrl(`/work/${p.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
      images: [absoluteUrl(p.cover.src)],
    })),
  ];
}
