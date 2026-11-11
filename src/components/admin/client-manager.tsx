"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClientMarquee } from "@/components/site/client-marquee";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveClients } from "@/features/clients/actions";
import type { AssetSummary } from "@/features/media/summary";
import { MediaPicker } from "./media-picker";

export type ClientRow = { id?: string; name: string; url: string; logo: AssetSummary | null; visible: boolean };

/**
 * Build the rotating client marquee: add clients, upload/pick white or mono logos, reorder, hide.
 * The preview below is the real marquee component.
 */
export function ClientManager({ initial, fallbackNames }: { initial: ClientRow[]; fallbackNames: string[] }) {
  const [rows, setRows] = useState(initial);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  const update = (next: ClientRow[]) => {
    setRows(next);
    setDirty(true);
  };
  const patch = (i: number, p: Partial<ClientRow>) => update(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [r] = next.splice(from, 1);
    next.splice(to, 0, r!);
    update(next);
  };

  function save() {
    startTransition(async () => {
      try {
        await saveClients(rows.map((r) => ({ id: r.id, name: r.name, url: r.url, logoId: r.logo?.id ?? null, visible: r.visible })));
        setDirty(false);
        toast.success("Marquee saved — it's live");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  const preview = rows
    .filter((r) => r.visible && r.name.trim())
    .map((r) => ({
      name: r.name,
      logo: r.logo?.url ? { src: r.logo.url, alt: r.name, width: r.logo.width ?? undefined, height: r.logo.height ?? undefined } : undefined,
    }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length ? `${rows.filter((r) => r.visible).length} visible of ${rows.length}` : "No clients yet — the site shows the marquee section's fallback names."}
        </p>
        <div className="flex gap-2">
          {!rows.length && fallbackNames.length ? (
            <Button variant="outline" onClick={() => update(fallbackNames.map((name) => ({ name, url: "", logo: null, visible: true })))}>
              Import {fallbackNames.length} current names
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => update([...rows, { name: "", url: "", logo: null, visible: true }])}>
            + Add client
          </Button>
          <Button disabled={pending || !dirty} onClick={save}>
            {pending ? "Saving…" : "Save marquee"}
          </Button>
        </div>
      </div>

      <section aria-label="Live preview" className="overflow-hidden rounded-md border border-border">
        <p className="border-b border-border px-4 py-2 text-xs tracking-wide text-muted-foreground uppercase">Preview</p>
        {preview.length ? <ClientMarquee label="Trusted by" speed={40} clients={preview} /> : <p className="p-6 text-sm text-muted-foreground">Add a client to see the marquee.</p>}
      </section>

      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.id ?? `new-${i}`} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-onyx p-3">
            <span className="w-6 text-xs text-red tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <button
              type="button"
              onClick={() => setPickerFor(i)}
              aria-label={`Choose logo for ${r.name || "client"}`}
              className="grid h-12 w-24 shrink-0 place-items-center overflow-hidden rounded bg-ink hover:ring-1 hover:ring-red"
            >
              {r.logo?.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview; rendered white like the site
                <img src={r.logo.url} alt="" className="max-h-7 w-auto brightness-0 invert" />
              ) : (
                <span className="text-[10px] text-muted-foreground uppercase">+ Logo</span>
              )}
            </button>
            <Input value={r.name} placeholder="Client name" aria-label="Client name" onChange={(e) => patch(i, { name: e.target.value })} className="min-w-40 flex-1" />
            <Input value={r.url} placeholder="https:// (optional)" aria-label="Client website" onChange={(e) => patch(i, { url: e.target.value })} className="min-w-40 flex-1" />
            <Switch checked={r.visible} onCheckedChange={(v) => patch(i, { visible: Boolean(v) })} aria-label="Visible" />
            <span className="flex gap-1">
              <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
                ↑
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, i + 1)}>
                ↓
              </Button>
              {r.logo ? (
                <Button size="sm" variant="ghost" onClick={() => patch(i, { logo: null })}>
                  Remove logo
                </Button>
              ) : null}
              <Button size="icon-sm" variant="ghost" aria-label="Delete client" onClick={() => update(rows.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        Tip: transparent PNG or SVG logos work best — they&apos;re shown white on dark tiles. Without a logo, the name is set in caps.
      </p>

      <MediaPicker
        open={pickerFor !== null}
        onOpenChange={(o) => !o && setPickerFor(null)}
        kind="IMAGE"
        title="Choose a logo"
        onPick={(a) => pickerFor !== null && patch(pickerFor, { logo: a })}
      />
    </div>
  );
}
