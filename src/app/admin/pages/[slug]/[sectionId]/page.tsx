import { notFound } from "next/navigation";
import { SectionEditor } from "@/components/admin/section-editor";
import { getSectionForEditor } from "@/features/pages/admin";
import { sectionRegistry } from "@/features/sections/registry";
import type { SectionType } from "@/features/sections/schemas";
import { requireAdmin } from "@/lib/session";

export default async function AdminSectionEditor({
  params,
}: PageProps<"/admin/pages/[slug]/[sectionId]">) {
  // Each page segment can be rendered/prefetched on its own (partial prefetching), so it must
  // authorize itself rather than rely on the layout guard. Also makes the page request-time.
  await requireAdmin();
  const { slug, sectionId } = await params;
  const section = await getSectionForEditor(sectionId);
  if (!section || section.page.slug !== slug || !(section.type in sectionRegistry)) notFound();
  const type = section.type as SectionType;
  return (
    <SectionEditor
      section={{ id: section.id, type, data: (section.data ?? {}) as Record<string, unknown> }}
      page={{ slug, title: section.page.title }}
      label={sectionRegistry[type].label}
    />
  );
}
