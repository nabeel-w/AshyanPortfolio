import { ProjectForm } from "@/components/admin/project-form";

export default function NewProjectPage() {
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
