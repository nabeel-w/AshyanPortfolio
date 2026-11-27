import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { pageSections, site as fallbackSite } from "@/content/fallback";
import {
  sectionSchemas,
  upgradeSectionData,
  type SectionData,
  type SectionProps,
} from "@/features/sections/schemas";
import type { Asset, Prisma } from "@/generated/prisma/client";
import { parsePageShare } from "@/features/seo/share";
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
export type LoopRef = NonNullable<WorkItem["loop"]>;

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

/** A READY video asset with a URL → the hover loop the grid plays (Blob, #26). Anything else → none. */
export function loopOf(
  a: Pick<Asset, "status" | "url" | "kind" | "width" | "height"> | null | undefined,
): LoopRef | undefined {
  if (a?.status !== "READY" || !a.url || (a.kind && a.kind !== "VIDEO")) return undefined;
  return { src: a.url, width: a.width ?? undefined, height: a.height ?? undefined };
}

/** What every grid query needs from a project row. */
const gridInclude = {
  cover: true,
  loop: true,
  labels: { include: { label: true }, orderBy: { order: "asc" } },
} satisfies Prisma.ProjectInclude;

type GridRow = Prisma.ProjectGetPayload<{ include: typeof gridInclude }>;

/** Grid order everywhere (home, /work, label pages, prev/next): featured first, then the admin order. */
export const gridOrder: Prisma.ProjectOrderByWithRelationInput[] = [
  { featured: "desc" },
  { order: "asc" },
  { publishedAt: "desc" },
];

/** A project row → a work-grid card. Only visible labels become card tags (they link to label pages). */
export function toWorkItem(p: GridRow): WorkItem | null {
  const cover = p.cover;
  if (!cover?.url) return null;
  return {
    slug: p.slug,
    title: p.title,
    format: p.format ?? "",
    year: p.year ?? p.createdAt.getFullYear(),
    labels: (p.labels ?? [])
      .filter((pl) => pl.label.visible)
      .map((pl) => ({ name: pl.label.name, slug: pl.label.slug })),
    cover: {
      src: cover.url,
      alt: cover.alt,
      width: cover.width ?? undefined,
      height: cover.height ?? undefined,
      blurDataUrl: cover.blurDataUrl ?? undefined,
    },
    loop: loopOf(p.loop),
    orientation: p.filmOrientation === "PORTRAIT" ? "portrait" : p.filmOrientation === "SQUARE" ? "square" : "landscape",
    cardSize: (p.cardSize?.toLowerCase() ?? "auto") as WorkItem["cardSize"],
    featured: p.featured,
  };
}

/** Published, featured-first projects mapped to work-grid cards (hover loop only once it is READY). */
export async function getPublishedProjects(): Promise<WorkItem[]> {
  "use cache";
  cacheTag(tags.projects, tags.labels);
  cacheLife("max");

  const projects = await db.project.findMany({
    where: { status: "PUBLISHED", cover: { status: "READY" } },
    orderBy: gridOrder,
    include: gridInclude,
  });
  return projects.flatMap((p) => toWorkItem(p) ?? []);
}

// ─── Labels (#28) ────────────────────────────────────────────────────────────

export type LabelSummary = { name: string; slug: string; count: number };
export type LabelPage = {
  name: string;
  slug: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  projects: WorkItem[];
};

/** Label chips from a list of cards, in first-seen order (fallback content has no Label table). */
export function labelsFromProjects(projects: WorkItem[]): LabelSummary[] {
  const out = new Map<string, LabelSummary>();
  for (const p of projects)
    for (const l of p.labels) {
      const hit = out.get(l.slug);
      if (hit) hit.count++;
      else out.set(l.slug, { name: l.name, slug: l.slug, count: 1 });
    }
  return [...out.values()];
}

/**
 * Every visible label in the admin order, with how many published films carry it. Labels without
 * work are included (count 0); callers that render chips or pages skip those. Empty Label table →
 * labels derived from the work list (fresh environments).
 */
export async function getLabels(): Promise<LabelSummary[]> {
  "use cache";
  cacheTag(tags.labels, tags.projects);
  cacheLife("max");

  const total = await db.label.count();
  if (!total) return labelsFromProjects(await getWorkList());
  const rows = await db.label.findMany({
    where: { visible: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      name: true,
      slug: true,
      _count: {
        select: { projects: { where: { project: { status: "PUBLISHED", cover: { status: "READY" } } } } },
      },
    },
  });
  return rows.map((r) => ({ name: r.name, slug: r.slug, count: r._count.projects }));
}

/**
 * A label landing page: the label and its published films in grid order. A renamed label's old slug
 * returns { redirect } (pages must never vanish under inbound links); hidden or unknown → null.
 */
export async function getLabel(
  slug: string,
): Promise<{ label: LabelPage } | { redirect: string } | null> {
  "use cache";
  cacheTag(tags.labels, tags.projects, tags.label(slug));
  cacheLife("max");

  if (!(await db.label.count())) {
    const work = await getWorkList();
    const hit = labelsFromProjects(work).find((l) => l.slug === slug);
    return hit
      ? {
          label: {
            name: hit.name,
            slug: hit.slug,
            projects: work.filter((p) => p.labels.some((l) => l.slug === slug)),
          },
        }
      : null;
  }

  const label = await db.label.findUnique({ where: { slug } });
  if (!label) {
    const moved = await db.label.findFirst({
      where: { previousSlugs: { has: slug } },
      select: { slug: true, visible: true },
    });
    return moved?.visible ? { redirect: moved.slug } : null;
  }
  if (!label.visible) return null;
  const rows = await db.project.findMany({
    where: { status: "PUBLISHED", cover: { status: "READY" }, labels: { some: { labelId: label.id } } },
    orderBy: gridOrder,
    include: gridInclude,
  });
  return {
    label: {
      name: label.name,
      slug: label.slug,
      description: label.description?.trim() || undefined,
      seoTitle: label.seoTitle?.trim() || undefined,
      seoDescription: label.seoDescription?.trim() || undefined,
      projects: rows.flatMap((p) => toWorkItem(p) ?? []),
    },
  };
}

/** The chips a work grid shows: "auto" = every label with work; a slug list = those, in that order. */
export function chipLabels(setting: "auto" | string[], labels: LabelSummary[]): LabelSummary[] {
  const withWork = labels.filter((l) => l.count > 0);
  if (setting === "auto") return withWork;
  return setting.flatMap((slug) => withWork.find((l) => l.slug === slug) ?? []);
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
    const parsed = sectionSchemas[type].safeParse(upgradeSectionData(type, row.data));
    if (!parsed.success) {
      console.warn(`[content] skipped invalid "${type}" section ${row.id} on ${context}:`, z.prettifyError(parsed.error));
      continue;
    }
    out.push({ id: row.id, type, visible: true, data: parsed.data } as SectionData);
  }
  return out;
}

/**
 * Fill collection sections from their tables when those have rows (work grid ← Project + Label,
 * marquee ← Client). On /work the chips filter in place; everywhere else they link to label pages.
 */
export async function hydrateSections(sections: SectionData[], pageSlug?: string): Promise<SectionData[]> {
  const [projects, clients] = await Promise.all([getPublishedProjects(), getClientLogos()]);
  // Only real projects have managed labels. Without them the chips come from the section's own cards
  // (and getLabels → getWorkList → the home page would recurse back here).
  const labels = projects.length && sections.some((s) => s.type === "workGrid") ? await getLabels() : [];
  return sections.map((s) => {
    if (s.type === "workGrid") {
      const list = projects.length ? projects : s.data.projects;
      return {
        ...s,
        data: {
          ...s.data,
          projects: list,
          labelList: chipLabels(s.data.labels, projects.length ? labels : labelsFromProjects(list)),
          chips: pageSlug === "work" ? "filter" : s.data.chips,
        },
      };
    }
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
  cacheTag(tags.page(slug), tags.projects, tags.clients, tags.labels);
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
  return hydrateSections(sections, slug);
}

/** SEO fields for a page (admin-editable), with sensible fallbacks. */
export async function getPageMeta(slug: string) {
  "use cache";
  cacheTag(tags.page(slug));
  cacheLife("max");
  const page = await db.page.findUnique({
    where: { slug },
    select: { title: true, seoTitle: true, seoDescription: true, share: true },
  });
  return {
    title: page?.seoTitle || page?.title || null,
    description: page?.seoDescription || null,
    /** This page's own share card (#33); empty fields fall through to Settings */
    share: parsePageShare(page?.share),
  };
}

/** Work list for sitemap / llms.txt: real projects, else whatever the home work grid shows. */
export async function getWorkList(): Promise<WorkItem[]> {
  const projects = await getPublishedProjects();
  if (projects.length) return projects;
  const home = await getPublishedPage("home");
  const grid = home.find((s) => s.type === "workGrid");
  return grid?.type === "workGrid" ? grid.data.projects : [];
}
