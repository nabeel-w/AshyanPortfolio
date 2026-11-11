import { notFound } from "next/navigation";
import { ProjectForm } from "@/components/admin/project-form";
import { toAssetSummary } from "@/features/media/summary";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function EditProjectPage({ params }: PageProps<"/admin/projects/[id]">) {
  // Each page segment can be rendered/prefetched on its own (partial prefetching), so it must
  // authorize itself rather than rely on the layout guard. Also makes the page request-time.
  await requireAdmin();
  const { id } = await params;
  const p = await db.project.findUnique({
    where: { id },
    include: {
      cover: true,
      film: true,
      loop: true,
      category: true,
      gallery: { include: { asset: true }, orderBy: { order: "asc" } },
    },
  });
  if (!p) notFound();
  const credits = Array.isArray(p.credits) ? (p.credits as { role: string; name: string }[]) : [];
  return (
    <ProjectForm
      id={p.id}
      initial={{
        title: p.title,
        slug: p.slug,
        format: p.format ?? "",
        category: p.category?.name ?? "",
        clientName: p.clientName ?? "",
        year: p.year ?? undefined,
        role: p.role ?? "",
        summary: p.summary ?? "",
        story: p.story ?? "",
        transcript: p.transcript ?? "",
        credits,
        featured: p.featured,
        order: p.order,
        status: p.status,
        seoTitle: p.seoTitle ?? "",
        seoDescription: p.seoDescription ?? "",
        cover: p.cover ? toAssetSummary(p.cover) : null,
        film: p.film ? toAssetSummary(p.film) : null,
        loop: p.loop ? toAssetSummary(p.loop) : null,
        gallery: p.gallery.map((g) => toAssetSummary(g.asset)),
      }}
    />
  );
}
