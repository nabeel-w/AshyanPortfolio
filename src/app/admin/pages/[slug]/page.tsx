import { notFound } from "next/navigation";
import { PageEditor } from "@/components/admin/page-editor";
import { getPageForEditor } from "@/features/pages/admin";
import { sectionRegistry } from "@/features/sections/registry";

export default async function AdminPageEditor({ params }: PageProps<"/admin/pages/[slug]">) {
  const { slug } = await params;
  const page = await getPageForEditor(slug);
  if (!page) notFound();
  const types = Object.entries(sectionRegistry).map(([type, r]) => ({ type, label: r.label, description: r.description }));
  return <PageEditor page={page} types={types} />;
}
