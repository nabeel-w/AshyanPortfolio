"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createLabel,
  deleteLabel,
  mergeLabel,
  reorderLabels,
  updateLabel,
  type LabelRow,
} from "@/features/labels/actions";
import { slugify } from "@/features/sections/schemas";
import { ConfirmButton } from "./confirm-button";

/**
 * Admin → Labels (#28): the managed list behind every chip, card tag and /work/label/<slug> page.
 * Reorder (the chip order everywhere), rename (slug only changes on request; old slugs redirect),
 * describe, hide, merge, delete. Each row saves on its own.
 */
export function LabelManager({ initial }: { initial: LabelRow[] }) {
  const [rows, setRows] = useState(initial);
  const [draftName, setDraftName] = useState("");
  const [pending, startTransition] = useTransition();

  const replace = (label: LabelRow) => setRows((r) => r.map((x) => (x.id === label.id ? label : x)));

  function add() {
    startTransition(async () => {
      const res = await createLabel(draftName);
      if (!res.ok) return void toast.error(res.error);
      setRows((r) => (r.some((x) => x.id === res.label.id) ? r : [...r, res.label]));
      setDraftName("");
      toast.success(`Label “${res.label.name}” ready`);
    });
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [r] = next.splice(from, 1);
    next.splice(to, 0, r!);
    setRows(next);
    startTransition(async () => {
      await reorderLabels(next.map((x) => x.id));
      toast.success("Order saved — chips follow it everywhere");
    });
  }

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (draftName.trim()) add();
        }}
      >
        <Input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="New label, e.g. Music video"
          aria-label="New label name"
          className="max-w-xs"
        />
        <Button type="submit" disabled={pending || !draftName.trim()}>
          + Add label
        </Button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">
          No labels yet. Add one, or create them from a project&apos;s Labels field.
        </p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <LabelItem
              key={r.id}
              label={r}
              index={i}
              total={rows.length}
              others={rows.filter((x) => x.id !== r.id)}
              onMove={(to) => move(i, to)}
              onSaved={replace}
              onMerged={(target) => setRows((all) => all.filter((x) => x.id !== r.id).map((x) => (x.id === target.id ? target : x)))}
              onDeleted={() => setRows((all) => all.filter((x) => x.id !== r.id))}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function LabelItem({
  label,
  index,
  total,
  others,
  onMove,
  onSaved,
  onMerged,
  onDeleted,
}: {
  label: LabelRow;
  index: number;
  total: number;
  others: LabelRow[];
  onMove: (to: number) => void;
  onSaved: (l: LabelRow) => void;
  onMerged: (target: LabelRow) => void;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState(label);
  const [reslug, setReslug] = useState(false);
  const [mergeInto, setMergeInto] = useState("");
  const [removeFromProjects, setRemoveFromProjects] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty =
    draft.name !== label.name ||
    (draft.description ?? "") !== (label.description ?? "") ||
    (draft.seoTitle ?? "") !== (label.seoTitle ?? "") ||
    (draft.seoDescription ?? "") !== (label.seoDescription ?? "") ||
    draft.visible !== label.visible ||
    reslug;
  const nextSlug = slugify(draft.name);

  function save() {
    startTransition(async () => {
      const res = await updateLabel(label.id, {
        name: draft.name,
        description: draft.description,
        seoTitle: draft.seoTitle,
        seoDescription: draft.seoDescription,
        visible: draft.visible,
        reslug,
      });
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.label);
      setDraft(res.label);
      setReslug(false);
      toast.success("Label saved — the site is updated");
    });
  }

  return (
    <li className="rounded-md border border-border bg-onyx p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-6 text-xs text-red tabular-nums">{String(index + 1).padStart(2, "0")}</span>
        <Input
          value={draft.name}
          aria-label="Label name"
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="max-w-56"
        />
        <a
          href={`/work/label/${label.slug}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-muted-foreground hover:text-ivory"
        >
          /work/label/{label.slug} ↗
        </a>
        <span className="text-xs text-muted-foreground">
          {label.projects} {label.projects === 1 ? "project" : "projects"}
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Visible
          <Switch
            checked={draft.visible}
            aria-label={`Show ${label.name} as a chip and page`}
            onCheckedChange={(v) => setDraft({ ...draft, visible: Boolean(v) })}
          />
        </span>
        <span className="flex gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => onMove(index - 1)}>
            ↑
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={index === total - 1} onClick={() => onMove(index + 1)}>
            ↓
          </Button>
        </span>
      </div>

      {draft.name !== label.name && nextSlug && nextSlug !== label.slug ? (
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={reslug} onChange={(e) => setReslug(e.target.checked)} />
          Also change the URL to /work/label/{nextSlug} (the old one keeps redirecting)
        </label>
      ) : null}

      <details className="mt-3 group">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-ivory">
          Description, SEO, merge and delete
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`d-${label.id}`}>
              Intro on the label page (1–2 sentences; search engines and AI assistants read it)
            </label>
            <Textarea
              id={`d-${label.id}`}
              rows={2}
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <Input
            value={draft.seoTitle ?? ""}
            placeholder={`SEO title (default “${draft.name} — Work”)`}
            aria-label="SEO title"
            onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })}
          />
          <Input
            value={draft.seoDescription ?? ""}
            placeholder="Meta description (default: the intro)"
            aria-label="Meta description"
            onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={mergeInto}
              onChange={(e) => setMergeInto(e.target.value)}
              aria-label="Merge into"
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">Merge into…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <ConfirmButton
              size="sm"
              variant="outline"
              disabled={!mergeInto || pending}
              confirmLabel="Merge for good?"
              onConfirm={() =>
                startTransition(async () => {
                  const res = await mergeLabel(label.id, mergeInto);
                  if (!res.ok) return void toast.error(res.error);
                  onMerged(res.label);
                  toast.success(`Merged into “${res.label.name}”; the old URL redirects`);
                })
              }
            >
              Merge
            </ConfirmButton>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={removeFromProjects} onChange={(e) => setRemoveFromProjects(e.target.checked)} />
              Remove from projects
            </label>
            <ConfirmButton
              size="sm"
              variant="ghost"
              disabled={pending || (label.projects > 0 && !removeFromProjects)}
              confirmLabel="Delete for good?"
              onConfirm={() =>
                startTransition(async () => {
                  const res = await deleteLabel(label.id, { removeFromProjects });
                  if (!res.ok) return void toast.error(res.error);
                  onDeleted();
                  toast.success("Label deleted");
                })
              }
            >
              Delete
            </ConfirmButton>
          </div>
        </div>
      </details>

      {dirty ? (
        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={pending || !draft.name.trim()} onClick={save}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(label);
              setReslug(false);
            }}
          >
            Discard
          </Button>
        </div>
      ) : null}
    </li>
  );
}
