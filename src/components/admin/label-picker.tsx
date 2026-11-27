"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createLabel } from "@/features/labels/actions";
import { cn } from "@/lib/utils";

export type PickedLabel = { id: string; name: string; slug: string };

/**
 * Several labels per project from the managed list (#28). Type to search, Enter (or the "Create"
 * option) to add a new one inline. The first label is the primary: it is the card tag, the breadcrumb
 * and drives "More in …". Reorder with the arrows.
 */
export function LabelPicker({
  value,
  options,
  onChange,
  onCreated,
  error,
}: {
  value: PickedLabel[];
  options: PickedLabel[];
  onChange: (labels: PickedLabel[]) => void;
  onCreated?: (label: PickedLabel) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pending, startTransition] = useTransition();
  const listId = useId();

  const chosen = new Set(value.map((l) => l.id));
  const q = query.trim().toLowerCase();
  const matches = options.filter((o) => !chosen.has(o.id) && (!q || o.name.toLowerCase().includes(q)));
  const exact = options.some((o) => o.name.toLowerCase() === q);
  const canCreate = q.length > 0 && !exact;
  const items = [...matches.map((m) => ({ kind: "pick" as const, label: m })), ...(canCreate ? [{ kind: "create" as const }] : [])];

  const add = (l: PickedLabel) => {
    if (!chosen.has(l.id)) onChange([...value, l]);
    setQuery("");
    setHighlight(0);
  };
  const create = () =>
    startTransition(async () => {
      const res = await createLabel(query);
      if (!res.ok) return void toast.error(res.error);
      const l = { id: res.label.id, name: res.label.name, slug: res.label.slug };
      onCreated?.(l);
      add(l);
    });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [l] = next.splice(from, 1);
    next.splice(to, 0, l!);
    onChange(next);
  };

  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Labels</p>
      {value.length ? (
        <ol className="mb-3 flex flex-wrap gap-2" aria-label="Chosen labels (first is primary)">
          {value.map((l, i) => (
            <li
              key={l.id}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2 py-1 text-sm",
                i === 0 ? "border-red text-ivory" : "border-border text-muted-foreground",
              )}
            >
              {i === 0 ? <span className="text-[10px] tracking-wide text-red uppercase">Primary</span> : null}
              <span>{l.name}</span>
              <Button type="button" size="icon-xs" variant="ghost" aria-label={`Move ${l.name} left`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                ←
              </Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label={`Move ${l.name} right`} disabled={i === value.length - 1} onClick={() => move(i, i + 1)}>
                →
              </Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label={`Remove ${l.name}`} onClick={() => onChange(value.filter((x) => x.id !== l.id))}>
                ✕
              </Button>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Add a label"
          placeholder={value.length ? "Add another label…" : "Search or create a label…"}
          value={query}
          disabled={pending}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const item = items[highlight];
              if (item?.kind === "pick") add(item.label);
              else if (item?.kind === "create") create();
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        {open && items.length ? (
          <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-graphite py-1 shadow-lg">
            {items.map((item, i) => (
              <li
                key={item.kind === "pick" ? item.label.id : "create"}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (item.kind === "pick") add(item.label);
                  else create();
                }}
                className={cn("cursor-pointer px-3 py-1.5 text-sm", i === highlight ? "bg-onyx text-ivory" : "text-muted-foreground")}
              >
                {item.kind === "pick" ? item.label.name : <>Create “{query.trim()}”</>}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        The first label is the primary one (card tag, breadcrumb, “More in …”). Manage all labels in Admin → Labels.
      </p>
      {error ? <p className="mt-1.5 text-xs text-red-bright">{error}</p> : null}
    </div>
  );
}
