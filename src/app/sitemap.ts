import type { MetadataRoute } from "next";
import { getProject } from "@/features/content/projects";
import { getLabels, getWorkList } from "@/features/content/queries";
import { absoluteUrl } from "@/lib/site-url";

const abs = (src: string) => (src.startsWith("http") ? src : absoluteUrl(src));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [work, labels] = await Promise.all([getWorkList(), getLabels()]);
  const projects = (await Promise.all(work.map((w) => getProject(w.slug)))).filter((p) => p !== null);

  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/work"), changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.6 },
    // One indexable page per visible label that has work (#28)
    ...labels
      .filter((l) => l.count > 0)
      .map((l) => ({
        url: absoluteUrl(`/work/label/${l.slug}`),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
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
              // The film lives on YouTube: point at its player, never at a file we don't host.
              player_loc: p.film.embedUrl,
              duration: p.film.duration ? Math.round(p.film.duration) : undefined,
              publication_date: p.publishedAt?.toISOString(),
            },
          ]
        : undefined,
    })),
  ];
}
