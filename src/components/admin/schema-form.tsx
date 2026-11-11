"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FieldDef } from "@/features/admin/fields";
import { MediaPicker } from "./media-picker";

type Obj = Record<string, unknown>;

/** Controlled form for a FieldDef[] over a plain object value. Every change emits the whole new object. */
export function SchemaForm({
  fields,
  value,
  onChange,
  errors,
}: {
  fields: FieldDef[];
  value: Obj;
  onChange: (next: Obj) => void;
  /** dotted path → message, e.g. { "cta.href": "Required" } */
  errors?: Record<string, string>;
}) {
  return (
    <div className="space-y-6">
      {fields.map((def) => (
        <Field
          key={def.name}
          def={def}
          value={value[def.name]}
          path={def.name}
          errors={errors}
          onChange={(v) => onChange({ ...value, [def.name]: v })}
        />
      ))}
    </div>
  );
}

function Field({
  def,
  value,
  onChange,
  path,
  errors,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  path: string;
  errors?: Record<string, string>;
}) {
  const id = `f-${path.replace(/\W+/g, "-")}`;
  const error = errors?.[path];

  if (def.type === "note") {
    return <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">{def.text}</p>;
  }

  const label = (
    <Label htmlFor={id} className="mb-2 block text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {def.label}
    </Label>
  );
  const help = def.help ? <p className="mt-1.5 text-xs text-muted-foreground">{def.help}</p> : null;
  const err = error ? <p className="mt-1.5 text-xs text-red-bright">{error}</p> : null;

  switch (def.type) {
    case "text":
    case "email":
    case "url":
      return (
        <div>
          {label}
          <Input
            id={id}
            type={def.type}
            value={String(value ?? "")}
            placeholder={def.placeholder}
            aria-invalid={Boolean(error)}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
          {err}
        </div>
      );
    case "textarea":
    case "richtext":
      return (
        <div>
          {label}
          <Textarea
            id={id}
            rows={def.rows ?? 3}
            value={String(value ?? "")}
            placeholder={def.type === "textarea" ? def.placeholder : undefined}
            aria-invalid={Boolean(error)}
            onChange={(e) => onChange(e.target.value)}
            className={def.type === "richtext" ? "font-serif text-lg" : undefined}
          />
          {def.type === "richtext" ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Wrap words in <code>*asterisks*</code> for the red italic accent, <code>**double**</code> for small caps.
            </p>
          ) : null}
          {help}
          {err}
        </div>
      );
    case "number":
      return (
        <div>
          {label}
          <Input
            id={id}
            type="number"
            min={def.min}
            max={def.max}
            step={def.step ?? 1}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          />
          {help}
          {err}
        </div>
      );
    case "select":
      return (
        <div>
          {label}
          <select
            id={id}
            value={String(value ?? def.options[0]?.value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm [&>option]:bg-onyx"
          >
            {def.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {help}
        </div>
      );
    case "switch":
      return (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
          <Label htmlFor={id} className="text-sm">
            {def.label}
          </Label>
          <Switch id={id} checked={Boolean(value)} onCheckedChange={(c) => onChange(c)} />
        </div>
      );
    case "lines":
      return (
        <div>
          {label}
          <Textarea
            id={id}
            rows={def.rows ?? 4}
            placeholder={def.placeholder}
            value={Array.isArray(value) ? (value as string[]).join("\n") : ""}
            onChange={(e) => onChange(e.target.value.split("\n").map((l) => l.trimStart()).filter((l, i, all) => l || i === all.length - 1))}
            onBlur={(e) => onChange(e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))}
          />
          {help}
          {err}
        </div>
      );
    case "image":
      return <ImageField id={id} label={def.label} help={def.help} value={value as Obj | undefined} onChange={onChange} error={error} />;
    case "group":
      return (
        <fieldset className="space-y-4 rounded-md border border-border p-4">
          <legend className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{def.label}</legend>
          {def.fields.map((f) => (
            <Field
              key={f.name}
              def={f}
              path={`${path}.${f.name}`}
              errors={errors}
              value={(value as Obj | undefined)?.[f.name]}
              onChange={(v) => onChange({ ...((value as Obj) ?? {}), [f.name]: v })}
            />
          ))}
        </fieldset>
      );
    case "list":
      return <ListField def={def} value={(value as Obj[]) ?? []} onChange={onChange} path={path} errors={errors} />;
  }
}

function ListField({
  def,
  value,
  onChange,
  path,
  errors,
}: {
  def: Extract<FieldDef, { type: "list" }>;
  value: Obj[];
  onChange: (v: unknown) => void;
  path: string;
  errors?: Record<string, string>;
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{def.label}</p>
      <ol className="space-y-3">
        {value.map((item, i) => (
          <li key={i} className="rounded-md border border-border">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <span className="truncate text-sm">
                <span className="mr-2 text-red tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {def.itemTitle ? String(item[def.itemTitle] ?? "") || "Untitled" : `Item ${i + 1}`}
              </span>
              <span className="flex shrink-0 gap-1">
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Move up" onClick={() => move(i, i - 1)} disabled={i === 0}>
                  ↑
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Move down" onClick={() => move(i, i + 1)} disabled={i === value.length - 1}>
                  ↓
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  ✕
                </Button>
              </span>
            </div>
            <div className="space-y-4 p-3">
              {def.item.map((f) => (
                <Field
                  key={f.name}
                  def={f}
                  path={`${path}.${i}.${f.name}`}
                  errors={errors}
                  value={item[f.name]}
                  onChange={(v) => onChange(value.map((it, j) => (j === i ? { ...it, [f.name]: v } : it)))}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onChange([...value, { ...def.newItem }])}>
        + {def.addLabel ?? "Add"}
      </Button>
    </div>
  );
}

function ImageField({
  id,
  label,
  help,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  help?: string;
  value: Obj | undefined;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const src = typeof value?.src === "string" ? value.src : "";
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-md border border-border bg-graphite hover:border-red"
          aria-label={`Choose ${label.toLowerCase()}`}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview
            <img src={src} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">Choose…</span>
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            id={id}
            value={String(value?.alt ?? "")}
            placeholder="Alt text — describe the image"
            onChange={(e) => onChange({ ...(value ?? {}), alt: e.target.value })}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            {src ? "Replace image" : "Choose image"}
          </Button>
        </div>
      </div>
      {help ? <p className="mt-1.5 text-xs text-muted-foreground">{help}</p> : null}
      {error ? <p className="mt-1.5 text-xs text-red-bright">{error}</p> : null}
      <MediaPicker
        open={open}
        onOpenChange={setOpen}
        kind="IMAGE"
        onPick={(a) =>
          onChange({
            src: a.url,
            alt: a.alt || String(value?.alt ?? ""),
            width: a.width ?? undefined,
            height: a.height ?? undefined,
            blurDataUrl: a.blurDataUrl ?? undefined,
          })
        }
      />
    </div>
  );
}
