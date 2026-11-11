import { ProjectForm } from "@/components/admin/project-form";
import { requireAdmin } from "@/lib/session";

export default async function NewProjectPage() {
  // Each page segment can be rendered/prefetched on its own (partial prefetching), so it must
  // authorize itself rather than rely on the layout guard. Also makes the page request-time.
  await requireAdmin();
  return (
    <ProjectForm
      id={null}
      initial={{
        title: "",
        slug: "",
        format: "",
        category: "",
        clientName: "",
        year: undefined,
        role: "",
        summary: "",
        story: "",
        transcript: "",
        credits: [],
        featured: false,
        order: 0,
        status: "DRAFT",
        seoTitle: "",
        seoDescription: "",
        cover: null,
        film: null,
        loop: null,
        gallery: [],
      }}
    />
  );
}
