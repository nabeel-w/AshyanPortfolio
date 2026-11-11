import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { homeSections, site as fallbackSite } from "@/content/fallback";
import { sectionSchemas, type SectionData, type SectionProps } from "@/features/sections/schemas";
import { db } from "@/lib/db";
import { tags } from "./tags";

/**
 * Public read layer. Every function is `"use cache"` + tagged, so public pages prerender into
 * the static shell and only refresh when an admin action invalidates the tag.
 *
 * Empty DB → fallback content (fresh environments still render a complete site).
 * DB errors are NOT swallowed: a broken connection should fail the build, not bake placeholders in.
 */

export type Site = typeof fallbackSite;
export type WorkItem = SectionProps<"workGrid">["projects"][number];

const socialsSchema = z.array(z.object({ label: z.string(), href: z.url() }));

export async function getSite(): Promise<Site> {
  "use cache";
  cacheTag(tags.site);
  cacheLife("max");

  const row = await db.siteSettings.findUnique({ where: { id: "site" } });
  if (!row) return fallbackSite;

  const socials = socialsSchema.safeParse(row.socials);
  return {
    ...fallbackSite,
    name: row.name,
    role: row.role,
    location: row.location ?? fallbackSite.location,
    email: row.email ?? fallbackSite.email,
    description: row.bio ?? fallbackSite.description,
    socials: socials.success && socials.data.length ? socials.data : fallbackSite.socials,
  };
}

/** Published, featured-first projects mapped to work-grid cards. Empty until projects are added (#11). */
export async function getPublishedProjects(): Promise<WorkItem[]> {
  "use cache";
  cacheTag(tags.projects);
  cacheLife("max");

  const projects = await db.project.findMany({
    where: { status: "PUBLISHED", cover: { status: "READY" } },
    orderBy: [{ featured: "desc" }, { order: "asc" }, { publishedAt: "desc" }],
    include: { category: true, cover: true, loop: true },
  });

  return projects.flatMap((p) => {
    const cover = p.cover;
    if (!cover?.url) return [];
    return [
      {
        slug: p.slug,
        title: p.title,
        format: p.format ?? "",
        year: p.year ?? p.createdAt.getFullYear(),
        category: p.category?.name ?? "Film",
        cover: {
          src: cover.url,
          alt: cover.alt,
          width: cover.width ?? undefined,
          height: cover.height ?? undefined,
          blurDataUrl: cover.blurDataUrl ?? undefined,
        },
        loopPlaybackId: p.loop?.playbackId ?? undefined,
      },
    ];
  });
}

async function getClientLogos(): Promise<SectionProps<"clientMarquee">["clients"]> {
  "use cache";
  cacheTag(tags.clients);
  cacheLife("max");

  const clients = await db.client.findMany({
    where: { visible: true },
    orderBy: { order: "asc" },
    include: { logo: true },
  });
  return clients.map((c) => ({
    name: c.name,
    logo: c.logo?.url
      ? { src: c.logo.url, alt: c.name, width: c.logo.width ?? undefined, height: c.logo.height ?? undefined }
      : undefined,
  }));
}

/**
 * A page's live sections, validated against the section schemas.
 * Collection sections are hydrated from their tables when those have rows
 * (work grid ← Project, client marquee ← Client); otherwise the section's own data is used.
 */
export async function getPublishedPage(slug: string): Promise<SectionData[]> {
  "use cache";
  cacheTag(tags.page(slug), tags.projects, tags.clients);
  cacheLife("max");

  const page = await db.page.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { sections: { where: { visible: true }, orderBy: { order: "asc" } } },
  });

  const sections: SectionData[] = [];
  for (const s of page?.sections ?? []) {
    if (!(s.type in sectionSchemas) || s.publishedData == null) continue;
    const type = s.type as keyof typeof sectionSchemas;
    const parsed = sectionSchemas[type].safeParse(s.publishedData);
    if (!parsed.success) {
      console.warn(`[content] skipped invalid "${type}" section ${s.id} on /${slug}:`, z.prettifyError(parsed.error));
      continue;
    }
    sections.push({ id: s.id, type, visible: true, data: parsed.data } as SectionData);
  }

  if (!sections.length) return slug === "home" ? homeSections : [];

  const [projects, clients] = await Promise.all([getPublishedProjects(), getClientLogos()]);
  return sections.map((s) => {
    if (s.type === "workGrid" && projects.length) return { ...s, data: { ...s.data, projects } };
    if (s.type === "clientMarquee" && clients.length) return { ...s, data: { ...s.data, clients } };
    return s;
  });
}

/** Work list for sitemap / llms.txt: real projects, else whatever the home work grid shows. */
export async function getWorkList(): Promise<WorkItem[]> {
  const projects = await getPublishedProjects();
  if (projects.length) return projects;
  const home = await getPublishedPage("home");
  const grid = home.find((s) => s.type === "workGrid");
  return grid?.type === "workGrid" ? grid.data.projects : [];
}
