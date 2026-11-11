import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { pageSections, site as fallbackSite } from "@/content/fallback";
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
    whatsapp: row.whatsapp ?? fallbackSite.whatsapp,
    whatsappMessage: row.whatsappMessage ?? fallbackSite.whatsappMessage,
  };
}

/** Published, featured-first projects mapped to work-grid cards (hover loop only once it is READY). */
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
        loopPlaybackId: p.loop?.status === "READY" ? (p.loop.playbackId ?? undefined) : undefined,
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

/** Validate stored section rows against their schemas; invalid/unknown/unpublished rows are skipped. */
export function parseSections(
  rows: { id: string; type: string; data: unknown }[],
  context: string,
): SectionData[] {
  const out: SectionData[] = [];
  for (const row of rows) {
    if (!(row.type in sectionSchemas) || row.data == null) continue;
    const type = row.type as keyof typeof sectionSchemas;
    const parsed = sectionSchemas[type].safeParse(row.data);
    if (!parsed.success) {
      console.warn(`[content] skipped invalid "${type}" section ${row.id} on ${context}:`, z.prettifyError(parsed.error));
      continue;
    }
    out.push({ id: row.id, type, visible: true, data: parsed.data } as SectionData);
  }
  return out;
}

/** Fill collection sections from their tables when those have rows (work grid ← Project, marquee ← Client). */
export async function hydrateSections(sections: SectionData[]): Promise<SectionData[]> {
  const [projects, clients] = await Promise.all([getPublishedProjects(), getClientLogos()]);
  return sections.map((s) => {
    if (s.type === "workGrid" && projects.length) return { ...s, data: { ...s.data, projects } };
    if (s.type === "clientMarquee" && clients.length) return { ...s, data: { ...s.data, clients } };
    return s;
  });
}

/**
 * A page's LIVE sections: publishedData in publishedOrder, only publishedVisible ones.
 * Pages with nothing published fall back to the placeholder content for known slugs.
 */
export async function getPublishedPage(slug: string): Promise<SectionData[]> {
  "use cache";
  cacheTag(tags.page(slug), tags.projects, tags.clients);
  cacheLife("max");

  const page = await db.page.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: { sections: { where: { publishedVisible: true }, orderBy: { publishedOrder: "asc" } } },
  });

  const sections = parseSections(
    (page?.sections ?? []).map((s) => ({ id: s.id, type: s.type, data: s.publishedData })),
    `/${slug}`,
  );
  if (!sections.length) return slug in pageSections ? pageSections[slug as keyof typeof pageSections] : [];
  return hydrateSections(sections);
}

/** SEO fields for a page (admin-editable), with sensible fallbacks. */
export async function getPageMeta(slug: string) {
  "use cache";
  cacheTag(tags.page(slug));
  cacheLife("max");
  const page = await db.page.findUnique({ where: { slug }, select: { title: true, seoTitle: true, seoDescription: true } });
  return { title: page?.seoTitle || page?.title || null, description: page?.seoDescription || null };
}

/** Work list for sitemap / llms.txt: real projects, else whatever the home work grid shows. */
export async function getWorkList(): Promise<WorkItem[]> {
  const projects = await getPublishedProjects();
  if (projects.length) return projects;
  const home = await getPublishedPage("home");
  const grid = home.find((s) => s.type === "workGrid");
  return grid?.type === "workGrid" ? grid.data.projects : [];
}
