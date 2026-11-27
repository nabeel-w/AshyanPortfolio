"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AssetSummary } from "@/features/media/summary";
import { clockDuration } from "@/features/media/delivery";
import { AssetThumb, MediaPicker } from "./media-picker";

/** Soft limits for hover loops: warn, never block (#26). */
const LOOP_WARN_SECONDS = 8;
const LOOP_WARN_BYTES = 8 * 1024 * 1024;

export function loopWarnings(asset: Pick<AssetSummary, "duration" | "bytes" | "width" | "height"> | null): string[] {
  if (!asset) return [];
  const out: string[] = [];
  if (asset.duration && asset.duration > LOOP_WARN_SECONDS) out.push(`It runs ${Math.round(asset.duration)} s; loops read best at 3–6 s.`);
  if (asset.bytes && asset.bytes > LOOP_WARN_BYTES) out.push(`It is ${(asset.bytes / 1024 / 1024).toFixed(1)} MB; aim for 2–4 MB so it starts instantly.`);
  if (asset.width && asset.height && Math.max(asset.width, asset.height) > 1280) out.push(`It is ${asset.width}×${asset.height}; 720p (1280 px long edge) is plenty.`);
  return out;
}

/** Pick one library asset by id (project cover / film / loop). */
export function AssetField({
  label,
  help,
  kind,
  asset,
  onChange,
  error,
  purpose,
}: {
  label: string;
  help?: string;
  kind: "IMAGE" | "VIDEO";
  asset: AssetSummary | null;
  onChange: (asset: AssetSummary | null) => void;
  error?: string;
  purpose?: "loop";
}) {
  const [open, setOpen] = useState(false);
  const warnings = purpose === "loop" ? loopWarnings(asset) : [];
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Choose ${label.toLowerCase()}`}
          className="relative grid aspect-video w-44 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-graphite hover:border-red"
        >
          {asset ? (
            <AssetThumb asset={asset} className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">Choose…</span>
          )}
          {asset?.kind === "VIDEO" ? (
            <span className="absolute right-1 bottom-1 rounded bg-ink/80 px-1.5 text-[10px] text-ivory">
              ▶ {asset.duration ? clockDuration(asset.duration) : "video"}
            </span>
          ) : null}
        </button>
        <div className="min-w-0 space-y-2">
          <p className="truncate text-sm text-ivory">{asset?.filename ?? "Nothing selected"}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
              {asset ? "Replace" : "Choose"}
            </Button>
            {asset ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {help ? <p className="mt-1.5 text-xs text-muted-foreground">{help}</p> : null}
      {warnings.map((w) => (
        <p key={w} className="mt-1.5 text-xs text-amber-300">
          ⚠ {w}
        </p>
      ))}
      {error ? <p className="mt-1.5 text-xs text-red-bright">{error}</p> : null}
      <MediaPicker open={open} onOpenChange={setOpen} kind={kind} onPick={onChange} purpose={purpose} />
    </div>
  );
}

/** Ordered list of images (project stills gallery). */
export function GalleryField({ assets, onChange }: { assets: AssetSummary[]; onChange: (assets: AssetSummary[]) => void }) {
  const [open, setOpen] = useState(false);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= assets.length) return;
    const next = [...assets];
    const [a] = next.splice(from, 1);
    next.splice(to, 0, a!);
    onChange(next);
  };
  return (
    <div>
      <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Stills gallery</p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {assets.map((a, i) => (
          <li key={`${a.id}-${i}`} className="overflow-hidden rounded-md border border-border">
            <AssetThumb asset={a} className="aspect-video w-full object-cover" />
            <div className="flex justify-between px-1">
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Move left" onClick={() => move(i, i - 1)}>
                ←
              </Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Remove" onClick={() => onChange(assets.filter((_, j) => j !== i))}>
                ✕
              </Button>
              <Button type="button" size="icon-xs" variant="ghost" aria-label="Move right" onClick={() => move(i, i + 1)}>
                →
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}>
        + Add still
      </Button>
      <MediaPicker open={open} onOpenChange={setOpen} kind="IMAGE" onPick={(a) => onChange([...assets, a])} />
    </div>
  );
}
