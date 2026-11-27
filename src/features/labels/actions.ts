"use server";

import { z } from "zod";
import { invalidate } from "@/features/content/invalidate";
import { slugify } from "@/features/sections/schemas";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

/**
 * Admin → Labels (#28). Every action checks the session itself and refreshes the label, grid and
 * project caches (labels show on every card). Renames keep the slug unless asked; an old slug is kept
 * in previousSlugs so /work/label/<old> keeps redirecting.
 */

const id = z.string().min(1).max(64);
const name = z.string().trim().min(1, "Name is required").max(40, "Keep labels short (40 characters)");
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

export type LabelRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  visible: boolean;
  order: number;
  previousSlugs: string[];
  /** All projects carrying it (any status) */
  projects: number;
};

export type LabelResult = { ok: true; label: LabelRow } | { ok: false; error: string };

async function row(labelId: string): Promise<LabelRow> {
  const l = await db.label.findUniqueOrThrow({
    where: { id: labelId },
    include: { _count: { select: { projects: true } } },
  });
  return {
    id: l.id,
    name: l.name,
    slug: l.slug,
    description: l.description,
    seoTitle: l.seoTitle,
    seoDescription: l.seoDescription,
    visible: l.visible,
    order: l.order,
    previousSlugs: l.previousSlugs,
    projects: l._count.projects,
  };
}

/** A free slug for `base` ("fashion", then "fashion-2"…), ignoring `except` (the label being renamed). */
async function freeSlug(base: string, except?: string) {
  const root = slugify(base) || "label";
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const clash = await db.label.findFirst({
      where: { OR: [{ slug: candidate }, { previousSlugs: { has: candidate } }], NOT: except ? { id: except } : undefined },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new Error("Couldn't find a free slug");
}

/** All labels for the admin (any visibility), in order. */
export async function listLabels(): Promise<LabelRow[]> {
  await requireAdmin();
  const rows = await db.label.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: { _count: { select: { projects: true } } },
  });
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    description: l.description,
    seoTitle: l.seoTitle,
    seoDescription: l.seoDescription,
    visible: l.visible,
    order: l.order,
    previousSlugs: l.previousSlugs,
    projects: l._count.projects,
  }));
}

/** Create (or reuse, matched by name/slug) a label. Used inline from the project form too. */
export async function createLabel(rawName: string): Promise<LabelResult> {
  await requireAdmin();
  const parsed = name.safeParse(rawName);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const existing = await db.label.findFirst({
    where: { OR: [{ slug: slugify(parsed.data) }, { name: { equals: parsed.data, mode: "insensitive" } }] },
  });
  if (existing) return { ok: true, label: await row(existing.id) };
  const last = await db.label.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  const label = await db.label.create({
    data: { name: parsed.data, slug: await freeSlug(parsed.data), order: (last?.order ?? -1) + 1 },
  });
  invalidate.labels(label.slug);
  return { ok: true, label: await row(label.id) };
}

const patch = z.object({
  name: name.optional(),
  description: optional(320),
  seoTitle: optional(70),
  seoDescription: optional(170),
  visible: z.boolean().optional(),
  /** Re-derive the slug from the (new) name. The old slug keeps redirecting. */
  reslug: z.boolean().optional(),
});

export async function updateLabel(labelId: string, raw: z.input<typeof patch>): Promise<LabelResult> {
  await requireAdmin();
  const parsed = patch.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { reslug, ...data } = parsed.data;
  const current = await db.label.findUniqueOrThrow({ where: { id: id.parse(labelId) } });
  let slug = current.slug;
  let previousSlugs = current.previousSlugs;
  if (reslug) {
    const next = await freeSlug(data.name ?? current.name, current.id);
    if (next !== current.slug) {
      slug = next;
      previousSlugs = [...new Set([...current.previousSlugs, current.slug])].filter((s) => s !== next);
    }
  }
  await db.label.update({ where: { id: current.id }, data: { ...data, slug, previousSlugs } });
  invalidate.labels(current.slug, slug);
  return { ok: true, label: await row(current.id) };
}

/** Save the admin order (array order). */
export async function reorderLabels(ids: string[]) {
  await requireAdmin();
  const list = z.array(id).max(500).parse(ids);
  await db.$transaction(list.map((labelId, order) => db.label.update({ where: { id: labelId }, data: { order } })));
  invalidate.labels();
}

/**
 * Merge `sourceId` into `targetId`: its projects get the target (keeping their position in each
 * project's order), its slugs redirect to the target, and the source is deleted.
 */
export async function mergeLabel(sourceId: string, targetId: string): Promise<LabelResult> {
  await requireAdmin();
  const [from, to] = [id.parse(sourceId), id.parse(targetId)];
  if (from === to) return { ok: false, error: "Pick a different label to merge into" };
  const [source, target] = await Promise.all([
    db.label.findUniqueOrThrow({ where: { id: from }, include: { projects: true } }),
    db.label.findUniqueOrThrow({ where: { id: to }, include: { projects: true } }),
  ]);
  const already = new Set(target.projects.map((p) => p.projectId));
  await db.$transaction(async (tx) => {
    for (const pl of source.projects) {
      if (!already.has(pl.projectId)) {
        await tx.projectLabel.create({ data: { projectId: pl.projectId, labelId: to, order: pl.order } });
      }
    }
    await tx.label.delete({ where: { id: from } });
    await tx.label.update({
      where: { id: to },
      data: {
        previousSlugs: [...new Set([...target.previousSlugs, source.slug, ...source.previousSlugs])].filter(
          (s) => s !== target.slug,
        ),
      },
    });
  });
  invalidate.labels(source.slug, target.slug);
  return { ok: true, label: await row(to) };
}

/** Delete a label. Refused while projects use it, unless `removeFromProjects` is set. */
export async function deleteLabel(labelId: string, opts: { removeFromProjects?: boolean } = {}) {
  await requireAdmin();
  const label = await db.label.findUniqueOrThrow({
    where: { id: id.parse(labelId) },
    include: { _count: { select: { projects: true } } },
  });
  if (label._count.projects && !opts.removeFromProjects) {
    return {
      ok: false as const,
      error: `${label._count.projects} project(s) use “${label.name}”. Tick “remove from projects” or merge it instead.`,
    };
  }
  await db.label.delete({ where: { id: label.id } });
  invalidate.labels(label.slug);
  return { ok: true as const };
}
