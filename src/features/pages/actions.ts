"use server";

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { pageSections } from "@/content/fallback";
import { invalidate } from "@/features/content/invalidate";
import { sectionSchemas, type SectionType } from "@/features/sections/schemas";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

/**
 * Section editor actions. Everything edits the DRAFT (data / order / visible);
 * only publishPage() copies drafts to the live columns and refreshes the public cache.
 */

const id = z.string().min(1).max(64);
const sectionType = z.enum(Object.keys(sectionSchemas) as [SectionType, ...SectionType[]]);

export type SaveResult = { ok: true; savedAt: string } | { ok: false; errors: Record<string, string> };

/** Validate + store a section's draft. Errors are keyed by dotted path for the form. */
export async function saveSectionDraft(sectionId: string, data: unknown): Promise<SaveResult> {
  await requireAdmin();
  const section = await db.section.findUniqueOrThrow({ where: { id: id.parse(sectionId) } });
  const schema = sectionSchemas[section.type as SectionType];
  if (!schema) return { ok: false, errors: { _: `Unknown section type ${section.type}` } };

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".") || "_"] ??= issue.message;
    return { ok: false, errors };
  }
  const updated = await db.section.update({
    where: { id: section.id },
    data: { data: parsed.data as Prisma.InputJsonValue },
  });
  return { ok: true, savedAt: updated.updatedAt.toISOString() };
}

export async function reorderSections(pageId: string, orderedIds: string[]) {
  await requireAdmin();
  const ids = z.array(id).parse(orderedIds);
  await db.$transaction(ids.map((sid, order) => db.section.update({ where: { id: sid, pageId: id.parse(pageId) }, data: { order } })));
}

export async function setSectionVisible(sectionId: string, visible: boolean) {
  await requireAdmin();
  await db.section.update({ where: { id: id.parse(sectionId) }, data: { visible: z.boolean().parse(visible) } });
}

/** Add a section at the end of the page, pre-filled with sensible content for its type. */
export async function addSection(pageId: string, type: string) {
  await requireAdmin();
  const t = sectionType.parse(type);
  const page = await db.page.findUniqueOrThrow({ where: { id: id.parse(pageId) }, include: { sections: { select: { order: true } } } });
  const example = Object.values(pageSections)
    .flat()
    .find((s) => s.type === t)?.data;
  const data = sectionSchemas[t].parse(example ?? {});
  const order = Math.max(-1, ...page.sections.map((s) => s.order)) + 1;
  const created = await db.section.create({
    data: { pageId: page.id, type: t, order, visible: true, data: data as Prisma.InputJsonValue },
  });
  return { id: created.id };
}

/**
 * Remove a section. Never-published sections are deleted; live ones are hidden in the draft
 * (they disappear from the site on the next publish) so the live page is never changed silently.
 */
export async function removeSection(sectionId: string) {
  await requireAdmin();
  const s = await db.section.findUniqueOrThrow({ where: { id: id.parse(sectionId) } });
  if (s.publishedData == null) {
    await db.section.delete({ where: { id: s.id } });
    return { deleted: true };
  }
  await db.section.update({ where: { id: s.id }, data: { visible: false } });
  return { deleted: false };
}

/** Make the drafts live: copy data/order/visible → published*, snapshot a revision, refresh cache. */
export async function publishPage(pageId: string, note?: string) {
  const session = await requireAdmin();
  const page = await db.page.findUniqueOrThrow({ where: { id: id.parse(pageId) }, include: { sections: true } });

  const invalid = page.sections.filter((s) => !sectionSchemas[s.type as SectionType]?.safeParse(s.data).success);
  if (invalid.length) {
    return { ok: false as const, error: `Fix ${invalid.length} section(s) with invalid content before publishing.` };
  }

  await db.$transaction([
    ...page.sections.map((s) =>
      db.section.update({
        where: { id: s.id },
        data: {
          publishedData: s.data as Prisma.InputJsonValue,
          publishedOrder: s.order,
          publishedVisible: s.visible,
        },
      }),
    ),
    db.page.update({ where: { id: page.id }, data: { status: "PUBLISHED", publishedAt: new Date() } }),
    db.pageRevision.create({
      data: {
        pageId: page.id,
        authorId: session.user.id,
        note: note?.slice(0, 200) || null,
        snapshot: page.sections.map((s) => ({ id: s.id, type: s.type, order: s.order, visible: s.visible, data: s.data })) as Prisma.InputJsonValue,
      },
    }),
  ]);
  invalidate.page(page.slug);
  return { ok: true as const };
}

/** Throw away unpublished edits: drafts go back to what is live. New (never published) sections are removed. */
export async function discardDrafts(pageId: string) {
  await requireAdmin();
  const sections = await db.section.findMany({ where: { pageId: id.parse(pageId) } });
  await db.$transaction(
    sections.map((s) =>
      s.publishedData == null
        ? db.section.delete({ where: { id: s.id } })
        : db.section.update({
            where: { id: s.id },
            data: { data: s.publishedData as Prisma.InputJsonValue, order: s.publishedOrder ?? s.order, visible: s.publishedVisible },
          }),
    ),
  );
}

const snapshotSchema = z.array(
  z.object({ id: z.string(), type: z.string(), order: z.number(), visible: z.boolean(), data: z.unknown() }),
);

/** Load a revision into the DRAFT (review in the editor, then publish). */
export async function restoreRevision(revisionId: string) {
  await requireAdmin();
  const rev = await db.pageRevision.findUniqueOrThrow({ where: { id: id.parse(revisionId) } });
  const snapshot = snapshotSchema.parse(rev.snapshot);
  const current = await db.section.findMany({ where: { pageId: rev.pageId }, select: { id: true } });
  const inSnapshot = new Set(snapshot.map((s) => s.id));

  await db.$transaction([
    // Sections added since the revision are hidden in the draft.
    ...current
      .filter((c) => !inSnapshot.has(c.id))
      .map((c) => db.section.update({ where: { id: c.id }, data: { visible: false } })),
    ...snapshot.map((s) =>
      db.section.upsert({
        where: { id: s.id },
        update: { order: s.order, visible: s.visible, data: s.data as Prisma.InputJsonValue },
        create: { id: s.id, pageId: rev.pageId, type: s.type, order: s.order, visible: s.visible, data: s.data as Prisma.InputJsonValue },
      }),
    ),
  ]);
}

const seoSchema = z.object({
  title: z.string().trim().min(1).max(80),
  seoTitle: z.string().trim().max(70),
  seoDescription: z.string().trim().max(170),
});

/** Page SEO fields apply immediately (they're metadata, not page content). */
export async function updatePageSeo(pageId: string, input: z.input<typeof seoSchema>) {
  await requireAdmin();
  const data = seoSchema.parse(input);
  const page = await db.page.update({
    where: { id: id.parse(pageId) },
    data: { title: data.title, seoTitle: data.seoTitle || null, seoDescription: data.seoDescription || null },
  });
  invalidate.page(page.slug);
}
