"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  addSection,
  discardDrafts,
  publishPage,
  removeSection,
  reorderSections,
  restoreRevision,
  setSectionVisible,
  updatePageSeo,
} from "@/features/pages/actions";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "./confirm-button";
import { DevicePreview, DeviceToggle, type Device } from "./device-preview";

type Section = { id: string; type: string; visible: boolean; dirty: boolean; isNew: boolean; liveVisible: boolean };
type Page = {
  id: string;
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  publishedAt: Date | null;
  sections: Section[];
  revisions: { id: string; createdAt: Date; note: string | null }[];
};

export function PageEditor({ page, types }: { page: Page; types: { type: string; label: string; description: string }[] }) {
  const router = useRouter();
  // Local copy for optimistic reorder/visibility; re-synced whenever the server sends fresh data
  // (router.refresh() after publish / discard / restore).
  const [sections, setSections] = useState(page.sections);
  const [serverSections, setServerSections] = useState(page.sections);
  if (serverSections !== page.sections) {
    setServerSections(page.sections);
    setSections(page.sections);
  }
  const [pending, startTransition] = useTransition();
  const [device, setDevice] = useState<Device>("desktop");
  const [adding, setAdding] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const labelOf = (t: string) => types.find((x) => x.type === t)?.label ?? t;
  const pendingCount = sections.filter((s) => s.dirty).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const run = (fn: () => Promise<unknown>, success?: string) =>
    startTransition(async () => {
      try {
        await fn();
        if (success) toast.success(success);
        router.refresh();
        frame.current?.contentWindow?.location.reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = sections.findIndex((s) => s.id === e.active.id);
    const to = sections.findIndex((s) => s.id === e.over!.id);
    const next = arrayMove(sections, from, to).map((s) => ({ ...s, dirty: true }));
    setSections(next);
    run(() => reorderSections(page.id, next.map((s) => s.id)));
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/pages" className="text-xs text-muted-foreground hover:text-foreground">
            ← Pages
          </Link>
          <h1 className="font-serif text-4xl text-ivory">{page.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {page.publishedAt ? `Live since ${new Date(page.publishedAt).toLocaleString()}` : "Not published yet"} ·{" "}
            <a href={page.slug === "home" ? "/" : `/${page.slug}`} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              View live ↗
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pendingCount ? <Badge variant="outline">{pendingCount} unpublished change{pendingCount === 1 ? "" : "s"}</Badge> : <Badge variant="secondary">Up to date</Badge>}
          <ConfirmButton
            variant="outline"
            disabled={pending || !pendingCount}
            confirmLabel="Yes, discard all drafts"
            onConfirm={() => run(() => discardDrafts(page.id), "Drafts discarded")}
          >
            Discard drafts
          </ConfirmButton>
          <Button
            disabled={pending || !pendingCount}
            onClick={() =>
              run(async () => {
                const res = await publishPage(page.id);
                if (!res.ok) throw new Error(res.error);
              }, "Published — the live site is updated")
            }
          >
            Publish
          </Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(22rem,28rem)_1fr]">
        <section aria-label="Sections" className="space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-2">
                {sections.map((s, i) => (
                  <SortableRow
                    key={s.id}
                    index={i}
                    section={s}
                    label={labelOf(s.type)}
                    href={`/admin/pages/${page.slug}/${s.id}`}
                    disabled={pending}
                    onFocus={() => frame.current?.contentWindow?.postMessage({ type: "az:preview:focus", id: s.id }, window.location.origin)}
                    onVisible={(v) => {
                      setSections((all) => all.map((x) => (x.id === s.id ? { ...x, visible: v, dirty: true } : x)));
                      run(() => setSectionVisible(s.id, v));
                    }}
                    onRemove={() => run(() => removeSection(s.id), s.isNew ? "Section deleted" : "Section hidden — publish to apply")}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>

          {adding ? (
            <div className="rounded-md border border-border bg-onyx p-3">
              <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">Add a section</p>
              <ul className="grid gap-1">
                {types.map((t) => (
                  <li key={t.type}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const { id } = await addSection(page.id, t.type);
                          router.push(`/admin/pages/${page.slug}/${id}`);
                        })
                      }
                      className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-graphite"
                    >
                      <span className="text-ivory">{t.label}</span>
                      <span className="block text-xs text-muted-foreground">{t.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
              + Add section
            </Button>
          )}

          <SeoForm page={page} disabled={pending} onSave={(v) => run(() => updatePageSeo(page.id, v), "SEO saved")} />

          {page.revisions.length ? (
            <details className="rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm">Revisions ({page.revisions.length})</summary>
              <ul className="mt-3 space-y-2">
                {page.revisions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                    <ConfirmButton
                      size="xs"
                      variant="outline"
                      disabled={pending}
                      confirmLabel="Load into draft?"
                      onConfirm={() => run(() => restoreRevision(r.id), "Revision loaded into the draft — review, then publish")}
                    >
                      Restore
                    </ConfirmButton>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <section aria-label="Draft preview" className="flex min-h-[70dvh] flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Draft preview</p>
            <DeviceToggle value={device} onChange={setDevice} />
          </div>
          <div className="min-h-[70dvh] flex-1">
            <DevicePreview ref={frame} key={device} device={device} src={`/preview/${page.slug}`} title={`Draft preview of ${page.title}`} />
          </div>
        </section>
      </div>
    </div>
  );
}

function SortableRow({
  section,
  label,
  index,
  href,
  disabled,
  onVisible,
  onRemove,
  onFocus,
}: {
  section: Section;
  label: string;
  index: number;
  href: string;
  disabled: boolean;
  onVisible: (v: boolean) => void;
  onRemove: () => void;
  onFocus: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onMouseEnter={onFocus}
      className={cn(
        "flex items-center gap-3 rounded-md border border-border bg-onyx px-3 py-2.5",
        isDragging && "z-10 border-red shadow-lg",
        !section.visible && "opacity-60",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${label}`}
        className="cursor-grab touch-none px-1 text-muted-foreground hover:text-foreground"
      >
        ⠿
      </button>
      <span className="w-6 text-xs text-red tabular-nums">{String(index + 1).padStart(2, "0")}</span>
      <Link href={href} className="min-w-0 flex-1 truncate text-sm text-ivory hover:text-red">
        {label}
      </Link>
      {section.isNew ? <Badge variant="outline">New</Badge> : section.dirty ? <Badge variant="outline">Draft</Badge> : null}
      <Switch checked={section.visible} disabled={disabled} onCheckedChange={(v) => onVisible(Boolean(v))} aria-label={`Show ${label}`} />
      <ConfirmButton size="xs" variant="ghost" aria-label={`Remove ${label}`} disabled={disabled} confirmLabel={section.isNew ? "Delete?" : "Hide?"} onConfirm={onRemove}>
        ✕
      </ConfirmButton>
    </li>
  );
}

function SeoForm({ page, disabled, onSave }: { page: Page; disabled: boolean; onSave: (v: { title: string; seoTitle: string; seoDescription: string }) => void }) {
  const [v, setV] = useState({ title: page.title, seoTitle: page.seoTitle, seoDescription: page.seoDescription });
  return (
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer text-sm">Search & sharing (SEO)</summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(v);
        }}
      >
        <label className="block text-xs text-muted-foreground">
          Page name (admin)
          <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className="mt-1" />
        </label>
        <label className="block text-xs text-muted-foreground">
          SEO title <span className="tabular-nums">({v.seoTitle.length}/70)</span>
          <Input value={v.seoTitle} maxLength={70} onChange={(e) => setV({ ...v, seoTitle: e.target.value })} className="mt-1" />
        </label>
        <label className="block text-xs text-muted-foreground">
          Meta description <span className="tabular-nums">({v.seoDescription.length}/170)</span>
          <Textarea rows={3} maxLength={170} value={v.seoDescription} onChange={(e) => setV({ ...v, seoDescription: e.target.value })} className="mt-1" />
        </label>
        <Button type="submit" size="sm" disabled={disabled}>
          Save SEO
        </Button>
      </form>
    </details>
  );
}
