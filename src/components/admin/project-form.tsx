"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FieldDef } from "@/features/admin/fields";
import type { AssetSummary } from "@/features/media/summary";
import { deleteProject, saveProject, type ProjectInput } from "@/features/projects/actions";
import { AssetField, GalleryField } from "./asset-field";
import { ConfirmButton } from "./confirm-button";
import { LabelPicker, type PickedLabel } from "./label-picker";
import { YouTubeFilmField, type YouTubeFilmValue } from "./youtube-film-field";
import { SchemaForm } from "./schema-form";

const contentFields: FieldDef[] = [
  { type: "text", name: "title", label: "Title" },
  { type: "text", name: "slug", label: "URL slug", help: "Leave empty to generate from the title. Changing it changes the page URL." },
  { type: "text", name: "format", label: "Format", placeholder: "Brand Film" },
  { type: "text", name: "clientName", label: "Client" },
  { type: "number", name: "year", label: "Year", min: 1990, max: 2100 },
  { type: "text", name: "role", label: "Your role", placeholder: "Edit · Colour · Sound design" },
  { type: "textarea", name: "summary", label: "Summary", rows: 2, help: "One or two sentences. Shown under the title and used as the meta description (≤ 160 characters)." },
  { type: "textarea", name: "story", label: "Story", rows: 8, help: "The brief, your approach and the result. Separate paragraphs with a blank line. Search engines and AI assistants read this." },
  {
    type: "textarea",
    name: "transcript",
    label: "Film transcript",
    rows: 6,
    help: "Optional. The spoken words / captions of the film. Shown under the film and given to search engines as the video transcript.",
  },
  {
    type: "list",
    name: "credits",
    label: "Credits",
    itemTitle: "role",
    addLabel: "Add credit",
    newItem: { role: "", name: "" },
    item: [
      { type: "text", name: "role", label: "Role", placeholder: "Director" },
      { type: "text", name: "name", label: "Name" },
    ],
  },
];

const seoFields: FieldDef[] = [
  { type: "text", name: "seoTitle", label: "SEO title", help: "Optional. Defaults to “Title — Format”." },
  { type: "textarea", name: "seoDescription", label: "Meta description", rows: 2, help: "Optional. Defaults to the summary." },
];

export type ProjectFormValue = Omit<
  ProjectInput,
  "coverId" | "loopId" | "galleryIds" | "labelIds" | "filmUrl" | "filmOrientation" | "filmAspect" | "filmRuntime"
> &
  YouTubeFilmValue & {
  cover: AssetSummary | null;
  loop: AssetSummary | null;
  labels: PickedLabel[];
  gallery: AssetSummary[];
};

export function ProjectForm({
  id,
  initial,
  labelOptions,
}: {
  id: string | null;
  initial: ProjectFormValue;
  labelOptions: PickedLabel[];
}) {
  const [options, setOptions] = useState(labelOptions);
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<ProjectFormValue>) => setValue((v) => ({ ...v, ...patch }));

  function save(status?: ProjectFormValue["status"]) {
    startTransition(async () => {
      const { cover, loop, gallery, labels, ...rest } = value;
      const res = await saveProject(id, {
        ...rest,
        status: status ?? rest.status,
        coverId: cover?.id ?? null,
        loopId: loop?.id ?? null,
        galleryIds: gallery.map((g) => g.id),
        labelIds: labels.map((l) => l.id),
      });
      if (!res.ok) {
        setErrors(res.errors);
        toast.error(Object.values(res.errors)[0] ?? "Please fix the highlighted fields");
        return;
      }
      setErrors({});
      if (status) set({ status });
      toast.success(status === "PUBLISHED" ? "Published — the project page is live" : "Saved");
      if (!id) router.replace(`/admin/projects/${res.id}`);
      else router.refresh();
    });
  }

  const live = value.status === "PUBLISHED";

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/projects" className="text-xs text-muted-foreground hover:text-foreground">
            ← Projects
          </Link>
          <h1 className="font-serif text-4xl text-ivory">{value.title || "New project"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {live ? "Published" : value.status === "ARCHIVED" ? "Archived" : "Draft"}
            {id && live ? (
              <>
                {" · "}
                <a href={`/work/${initial.slug}`} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                  View live ↗
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {id ? (
            <ConfirmButton
              variant="ghost"
              disabled={pending}
              confirmLabel="Delete for good?"
              onConfirm={() =>
                startTransition(async () => {
                  await deleteProject(id);
                  toast.success("Project deleted");
                  router.replace("/admin/projects");
                })
              }
            >
              Delete
            </ConfirmButton>
          ) : null}
          {live ? (
            <Button variant="outline" disabled={pending} onClick={() => save("DRAFT")}>
              Unpublish
            </Button>
          ) : null}
          <Button variant={live ? "default" : "outline"} disabled={pending} onClick={() => save()}>
            Save
          </Button>
          {!live ? (
            <Button disabled={pending} onClick={() => save("PUBLISHED")}>
              Save & publish
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <section className="rounded-md border border-border bg-onyx p-5">
          <SchemaForm
            fields={contentFields}
            value={value as unknown as Record<string, unknown>}
            onChange={(v) => setValue(v as unknown as ProjectFormValue)}
            errors={errors}
          />
          <div className="mt-6">
            <LabelPicker
              value={value.labels}
              options={options}
              onChange={(labels) => set({ labels })}
              onCreated={(l) => setOptions((o) => [...o, l])}
              error={errors.labelIds}
            />
          </div>
        </section>
        <section aria-label="Film" className="rounded-md border border-border bg-onyx p-5 xl:col-start-1">
          <YouTubeFilmField
            value={value}
            onChange={set}
            onUseTitle={(title) => set({ title })}
            errors={errors}
          />
        </section>
        <aside className="space-y-6 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <section className="space-y-6 rounded-md border border-border bg-onyx p-5">
            <AssetField
              label="Cover (hi-res still)"
              kind="IMAGE"
              asset={value.cover}
              onChange={(cover) => set({ cover })}
              error={errors.coverId}
              help="Shown on the work grid, as the film poster, and in link previews. Use a sharp 16:9 still, at least 1920px wide."
            />
            <AssetField
              label="Hover preview (short loop)"
              kind="VIDEO"
              purpose="loop"
              asset={value.loop}
              onChange={(loop) => set({ loop })}
              help="Loop: 3–6 s, muted, H.264 MP4 (or WebM), ≤ 720p (≤ 1280 px long edge), ~2–4 MB. Shoot reels’ loops in 9:16. Plays over the cover on hover (desktop) or while in view (phones)."
            />
            <GalleryField assets={value.gallery} onChange={(gallery) => set({ gallery })} />
          </section>
          <section className="space-y-5 rounded-md border border-border bg-onyx p-5">
            <SchemaForm
              fields={[
                { type: "switch", name: "featured", label: "Featured (shown first)" },
                { type: "number", name: "order", label: "Order", min: 0, help: "Lower numbers come first." },
                ...seoFields,
              ]}
              value={value as unknown as Record<string, unknown>}
              onChange={(v) => setValue(v as unknown as ProjectFormValue)}
              errors={errors}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
