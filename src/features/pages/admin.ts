import "server-only";
import { db } from "@/lib/db";

/** Uncached reads for the admin editor (always fresh). Callers must have checked requireAdmin(). */

export type EditorSection = {
  id: string;
  type: string;
  order: number;
  visible: boolean;
  data: unknown;
  /** draft differs from live (content, order or visibility) */
  dirty: boolean;
  /** never published */
  isNew: boolean;
  liveVisible: boolean;
  updatedAt: Date;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function sectionState(s: {
  data: unknown;
  publishedData: unknown;
  order: number;
  publishedOrder: number | null;
  visible: boolean;
  publishedVisible: boolean;
}) {
  const isNew = s.publishedData == null;
  const dirty = isNew || !same(s.data, s.publishedData) || s.order !== s.publishedOrder || s.visible !== s.publishedVisible;
  return { isNew, dirty };
}

export async function listPagesForAdmin() {
  const pages = await db.page.findMany({
    orderBy: { createdAt: "asc" },
    include: { sections: true },
  });
  return pages.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    status: p.status,
    publishedAt: p.publishedAt,
    sections: p.sections.length,
    pendingChanges: p.sections.filter((s) => sectionState(s).dirty).length,
  }));
}

export async function getPageForEditor(slug: string) {
  const page = await db.page.findUnique({
    where: { slug },
    include: {
      sections: { orderBy: { order: "asc" } },
      revisions: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, createdAt: true, note: true } },
    },
  });
  if (!page) return null;
  const sections: EditorSection[] = page.sections.map((s) => ({
    id: s.id,
    type: s.type,
    order: s.order,
    visible: s.visible,
    data: s.data,
    ...sectionState(s),
    liveVisible: s.publishedVisible,
    updatedAt: s.updatedAt,
  }));
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    seoTitle: page.seoTitle ?? "",
    seoDescription: page.seoDescription ?? "",
    status: page.status,
    publishedAt: page.publishedAt,
    sections,
    revisions: page.revisions,
  };
}

export async function getSectionForEditor(id: string) {
  return db.section.findUnique({
    where: { id },
    include: { page: { select: { slug: true, title: true } } },
  });
}
