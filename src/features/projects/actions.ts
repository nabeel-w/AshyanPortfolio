"use server";

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { invalidate } from "@/features/content/invalidate";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { parseRuntime, parseYouTubeUrl, watchUrl } from "@/lib/youtube";

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const optionalId = z.string().min(1).max(64).nullish().transform((v) => v || null);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

const projectInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  slug: z.string().trim().max(80).optional(),
  format: optionalText(60),
  clientName: optionalText(120),
  year: z.coerce.number().int().min(1990).max(2100).nullish(),
  role: optionalText(120),
  summary: optionalText(200),
  story: optionalText(8000),
  transcript: optionalText(50000),
  credits: z.array(z.object({ role: z.string().trim().max(80), name: z.string().trim().max(120) })).default([]),
  featured: z.boolean().default(false),
  /** Bento tile override (#29); AUTO = from the film's orientation */
  cardSize: z.enum(["AUTO", "FEATURE", "WIDE", "TALL", "SQUARE"]).default("AUTO"),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  coverId: optionalId,
  /** YouTube link (watch, youtu.be, /shorts/…). Validated with the same parser the site uses. */
  filmUrl: z
    .string()
    .trim()
    .max(2048)
    .nullish()
    .transform((v) => v || null)
    .refine((v) => !v || parseYouTubeUrl(v) !== null, "Paste a YouTube link (watch, youtu.be or /shorts/)"),
  filmOrientation: z.enum(["LANDSCAPE", "PORTRAIT", "SQUARE"]).default("LANDSCAPE"),
  /** Optional exact width / height, e.g. 2.39 */
  filmAspect: z.coerce.number().min(0.25).max(4).nullish().catch(null),
  /** Runtime as typed: "2:41", "1:02:03" or seconds */
  filmRuntime: z
    .string()
    .trim()
    .max(12)
    .nullish()
    .refine((v) => !v || parseRuntime(v) !== null, "Use minutes:seconds, e.g. 2:41"),
  loopId: optionalId,
  galleryIds: z.array(z.string().min(1).max(64)).default([]),
  /** Ordered; the first is the primary label (#28) */
  labelIds: z.array(z.string().min(1).max(64)).max(12, "Up to 12 labels").default([]),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
});

export type ProjectInput = z.input<typeof projectInput>;
export type SaveProjectResult = { ok: true; id: string; slug: string } | { ok: false; errors: Record<string, string> };

export async function saveProject(id: string | null, raw: ProjectInput): Promise<SaveProjectResult> {
  await requireAdmin();
  const parsed = projectInput.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[i.path.join(".")] ??= i.message;
    return { ok: false, errors };
  }
  const input = parsed.data;
  const slug = slugify(input.slug || input.title);
  if (!slug) return { ok: false, errors: { slug: "Add a title or slug with letters or numbers" } };

  const clash = await db.project.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== id) return { ok: false, errors: { slug: `“${slug}” is already used by another project` } };
  if (input.status === "PUBLISHED" && !input.coverId) {
    return { ok: false, errors: { coverId: "A published project needs a cover image" } };
  }

  const film = parseYouTubeUrl(input.filmUrl);
  const previous = id ? await db.project.findUnique({ where: { id }, select: { slug: true, status: true, publishedAt: true } }) : null;
  const data = {
    slug,
    title: input.title,
    format: input.format,
    clientName: input.clientName,
    year: input.year ?? null,
    role: input.role,
    summary: input.summary,
    story: input.story,
    transcript: input.transcript,
    credits: input.credits.filter((c) => c.role || c.name) as Prisma.InputJsonValue,
    featured: input.featured,
    cardSize: input.cardSize,
    order: input.order,
    status: input.status,
    publishedAt: input.status === "PUBLISHED" ? (previous?.publishedAt ?? new Date()) : (previous?.publishedAt ?? null),
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    coverId: input.coverId,
    filmUrl: input.filmUrl,
    filmYoutubeId: film?.id ?? null,
    filmOrientation: input.filmOrientation,
    filmAspect: input.filmUrl ? (input.filmAspect ?? null) : null,
    filmDuration: input.filmUrl ? parseRuntime(input.filmRuntime) : null,
    loopId: input.loopId,
  };

  const project = await db.$transaction(async (tx) => {
    const p = id ? await tx.project.update({ where: { id }, data }) : await tx.project.create({ data });
    await tx.projectLabel.deleteMany({ where: { projectId: p.id } });
    const labelIds = [...new Set(input.labelIds)];
    if (labelIds.length) {
      await tx.projectLabel.createMany({ data: labelIds.map((labelId, order) => ({ projectId: p.id, labelId, order })) });
    }
    await tx.projectMedia.deleteMany({ where: { projectId: p.id } });
    if (input.galleryIds.length) {
      await tx.projectMedia.createMany({ data: input.galleryIds.map((assetId, order) => ({ projectId: p.id, assetId, order })) });
    }
    return p;
  });

  invalidate.projects(project.slug);
  invalidate.labels();
  if (previous && previous.slug !== project.slug) invalidate.projects(previous.slug);
  return { ok: true, id: project.id, slug: project.slug };
}

export async function deleteProject(id: string) {
  await requireAdmin();
  const p = await db.project.delete({ where: { id: z.string().min(1).parse(id) } });
  invalidate.projects(p.slug);
  invalidate.labels();
}

export type YouTubeLookup = { ok: true; title: string; author?: string } | { ok: false; error: string };

/**
 * "Use YouTube title" in the project form: oEmbed gives the public title (and channel). It is only a
 * prefill. Orientation never comes from here: Shorts report landscape thumbnails (#24).
 */
export async function lookupYouTube(url: string): Promise<YouTubeLookup> {
  await requireAdmin();
  const parsed = parseYouTubeUrl(z.string().max(2048).parse(url));
  if (!parsed) return { ok: false, error: "Not a YouTube link" };
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(parsed.id, parsed.kind))}`,
      { signal: AbortSignal.timeout(5000), cache: "no-store" },
    );
    if (res.status === 401 || res.status === 403) return { ok: false, error: "This video can't be embedded (private, or embedding is off)." };
    if (!res.ok) return { ok: false, error: `YouTube said ${res.status}. Check the link is public or unlisted.` };
    const body = (await res.json()) as { title?: unknown; author_name?: unknown };
    if (typeof body.title !== "string") return { ok: false, error: "YouTube returned no title" };
    return { ok: true, title: body.title.slice(0, 120), author: typeof body.author_name === "string" ? body.author_name : undefined };
  } catch {
    return { ok: false, error: "Couldn't reach YouTube" };
  }
}
