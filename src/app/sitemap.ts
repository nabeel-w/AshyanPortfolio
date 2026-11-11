import type { MetadataRoute } from "next";
import { getProject } from "@/features/content/projects";
import { getWorkList } from "@/features/content/queries";
import { mux } from "@/features/media/delivery";
import { absoluteUrl } from "@/lib/site-url";

const abs = (src: string) => (src.startsWith("http") ? src : absoluteUrl(src));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const work = await getWorkList();
  const projects = (await Promise.all(work.map((w) => getProject(w.slug)))).filter((p) => p !== null);

  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/work"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.6 },
    ...projects.map((p) => ({
      url: absoluteUrl(`/work/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
      images: [abs(p.cover.src)],
      // Video sitemap entries help the films surface in video search.
      videos: p.film
        ? [
            {
              title: p.title,
              description: p.summary || `${p.title}, edited by Ashyan Zafar.`,
              thumbnail_loc: abs(p.cover.src),
              content_loc: mux.mp4(p.film.playbackId),
              duration: p.film.duration ? Math.round(p.film.duration) : undefined,
              publication_date: p.publishedAt?.toISOString(),
            },
          ]
        : undefined,
    })),
  ];
}
