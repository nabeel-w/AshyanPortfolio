"use server";

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { invalidate } from "@/features/content/invalidate";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

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
  category: optionalText(60),
  summary: optionalText(200),
  story: optionalText(8000),
  transcript: optionalText(50000),
  credits: z.array(z.object({ role: z.string().trim().max(80), name: z.string().trim().max(120) })).default([]),
  featured: z.boolean().default(false),
  order: z.coerce.number().int().min(0).max(9999).default(0),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  coverId: optionalId,
  filmId: optionalId,
  loopId: optionalId,
  galleryIds: z.array(z.string().min(1).max(64)).default([]),
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

  const category = input.category
    ? await db.category.upsert({
        where: { slug: slugify(input.category) },
        update: {},
        create: { name: input.category, slug: slugify(input.category) },
      })
    : null;

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
    order: input.order,
    status: input.status,
    publishedAt: input.status === "PUBLISHED" ? (previous?.publishedAt ?? new Date()) : (previous?.publishedAt ?? null),
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    categoryId: category?.id ?? null,
    coverId: input.coverId,
    filmId: input.filmId,
    loopId: input.loopId,
  };

  const project = await db.$transaction(async (tx) => {
    const p = id ? await tx.project.update({ where: { id }, data }) : await tx.project.create({ data });
    await tx.projectMedia.deleteMany({ where: { projectId: p.id } });
    if (input.galleryIds.length) {
      await tx.projectMedia.createMany({ data: input.galleryIds.map((assetId, order) => ({ projectId: p.id, assetId, order })) });
    }
    return p;
  });

  invalidate.projects(project.slug);
  if (previous && previous.slug !== project.slug) invalidate.projects(previous.slug);
  return { ok: true, id: project.id, slug: project.slug };
}

export async function deleteProject(id: string) {
  await requireAdmin();
  const p = await db.project.delete({ where: { id: z.string().min(1).parse(id) } });
  invalidate.projects(p.slug);
}
