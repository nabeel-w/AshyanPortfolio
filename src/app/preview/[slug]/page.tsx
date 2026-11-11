import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSite, hydrateSections, parseSections } from "@/features/content/queries";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PreviewBridge } from "./preview-bridge";

// Session + draft data on every request; opt out of instant-navigation validation.
export const instant = false;

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

/**
 * Admin-only DRAFT preview, loaded in the editor's iframe.
 *   /preview/home                → whole page (draft order/visibility/content)
 *   /preview/home?section=<id>   → just that section
 * Live edits arrive via postMessage from the editor (see PreviewBridge).
 */
export default function PreviewPage(props: PageProps<"/preview/[slug]">) {
  return (
    <Suspense fallback={null}>
      <Preview {...props} />
    </Suspense>
  );
}

async function Preview({ params, searchParams }: PageProps<"/preview/[slug]">) {
  await requireAdmin();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const only = typeof query.section === "string" ? query.section : undefined;

  const page = await db.page.findUnique({
    where: { slug },
    include: { sections: { where: only ? { id: only } : { visible: true }, orderBy: { order: "asc" } } },
  });
  if (!page) notFound();

  const [sections, site] = await Promise.all([
    hydrateSections(parseSections(page.sections.map((s) => ({ id: s.id, type: s.type, data: s.data })), `preview:/${slug}`)),
    getSite(),
  ]);
  return <PreviewBridge initial={sections} site={site} />;
}
