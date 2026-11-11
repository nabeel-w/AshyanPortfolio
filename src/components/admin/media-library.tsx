"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeUploadAction, deleteAssetAction, listAssetsAction, updateAssetAction } from "@/features/media/actions";
import { uploadFile } from "@/features/media/client/upload";
import { clockDuration } from "@/features/media/delivery";
import type { AssetSummary } from "@/features/media/summary";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "./confirm-button";
import { assetThumb } from "./media-picker";

type Upload = { name: string; progress: number; error?: string };
const KINDS = ["ALL", "IMAGE", "VIDEO", "DOCUMENT"] as const;

/** Media library: drag-and-drop uploads straight to the provider, grid, alt text, delete. */
export function MediaLibrary({ initial }: { initial: AssetSummary[] }) {
  const [assets, setAssets] = useState(initial);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [filter, setFilter] = useState<(typeof KINDS)[number]>("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => startTransition(async () => setAssets(await listAssetsAction()));

  // Streaming video is transcoded at the provider. Webhooks can't reach localhost, so poll while anything is processing.
  const processing = assets.filter((a) => a.status === "PROCESSING").map((a) => a.id);
  useEffect(() => {
    if (!processing.length) return;
    const t = setInterval(async () => {
      for (const id of processing) await completeUploadAction(id).catch(() => null);
      refresh();
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing.join(",")]);

  async function upload(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      setUploads((u) => [...u, { name: file.name, progress: 0 }]);
      const patch = (p: Partial<Upload>) => setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, ...p } : x)));
      try {
        await uploadFile(file, { onProgress: (progress) => patch({ progress }) });
        setUploads((u) => u.filter((x) => x.name !== file.name));
        toast.success(`${file.name} uploaded`);
      } catch (e) {
        patch({ error: e instanceof Error ? e.message : "Upload failed" });
      }
      refresh();
    }
  }

  const shown = assets.filter((a) => filter === "ALL" || a.kind === filter);
  const current = assets.find((a) => a.id === selected) ?? null;

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        }}
        className={cn(
          "grid place-items-center rounded-md border border-dashed border-border px-6 py-10 text-center transition-colors",
          dragging && "border-red bg-red/5",
        )}
      >
        <p className="font-serif text-2xl text-ivory">Drop stills, films or PDFs here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Files go straight to storage (images → Vercel Blob, video → Mux). Videos take a minute to process.
        </p>
        <input ref={fileRef} type="file" multiple hidden accept="image/*,video/*,application/pdf" onChange={(e) => e.target.files && upload(e.target.files)} />
        <Button className="mt-4" onClick={() => fileRef.current?.click()}>
          Choose files
        </Button>
        {uploads.length ? (
          <ul className="mt-6 w-full max-w-md space-y-2 text-left">
            {uploads.map((u) => (
              <li key={u.name} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span className="truncate">{u.name}</span>
                  <span className={u.error ? "text-red-bright" : "text-muted-foreground"}>{u.error ?? `${Math.round(u.progress * 100)}%`}</span>
                </div>
                <div className="mt-1 h-0.5 bg-graphite">
                  <div className="h-full bg-red transition-[width]" style={{ width: `${u.progress * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
            {k === "ALL" ? "All" : k[0] + k.slice(1).toLowerCase() + "s"}
          </Button>
        ))}
        <span className="ml-auto self-center text-xs text-muted-foreground">{shown.length} files</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setSelected(a.id)}
                className={cn(
                  "block w-full overflow-hidden rounded-md border text-left transition-colors",
                  selected === a.id ? "border-red" : "border-border hover:border-red/60",
                )}
              >
                <span className="relative block aspect-video bg-graphite">
                  {a.status === "READY" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail, any provider host
                    <img src={assetThumb(a)} alt={a.alt} loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-xs text-muted-foreground">{a.status.toLowerCase()}…</span>
                  )}
                  {a.kind === "VIDEO" && a.duration ? (
                    <span className="absolute right-1 bottom-1 rounded bg-ink/80 px-1.5 text-[10px] text-ivory">▶ {clockDuration(a.duration)}</span>
                  ) : null}
                </span>
                <span className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="truncate text-xs text-muted-foreground">{a.filename}</span>
                  {!a.alt && a.kind === "IMAGE" ? <span className="size-1.5 shrink-0 rounded-full bg-red" title="Missing alt text" /> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <aside className="xl:sticky xl:top-8 xl:self-start">
          {current ? <AssetPanel key={current.id} asset={current} onChanged={refresh} onDeleted={() => (setSelected(null), refresh())} /> : (
            <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">Select a file to edit its alt text or delete it.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function AssetPanel({ asset, onChanged, onDeleted }: { asset: AssetSummary; onChanged: () => void; onDeleted: () => void }) {
  const [alt, setAlt] = useState(asset.alt);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-4 rounded-md border border-border bg-onyx p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
      <img src={assetThumb(asset)} alt="" className="aspect-video w-full rounded object-cover" />
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{asset.kind.toLowerCase()}</Badge>
        <Badge variant="outline">{asset.provider}</Badge>
        <Badge variant={asset.status === "READY" ? "secondary" : "outline"}>{asset.status.toLowerCase()}</Badge>
        {asset.width ? <Badge variant="outline">{asset.width}×{asset.height}</Badge> : null}
        {asset.bytes ? <Badge variant="outline">{(asset.bytes / 1024 / 1024).toFixed(1)} MB</Badge> : null}
      </div>
      <p className="truncate text-sm text-ivory">{asset.filename}</p>
      <label className="block text-xs text-muted-foreground">
        Alt text {asset.kind === "IMAGE" ? "(describe the image for screen readers and search)" : ""}
        <Input value={alt} onChange={(e) => setAlt(e.target.value)} className="mt-1" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending || alt === asset.alt}
          onClick={() =>
            startTransition(async () => {
              await updateAssetAction(asset.id, { alt });
              toast.success("Saved");
              onChanged();
            })
          }
        >
          Save
        </Button>
        {asset.url ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(asset.url!);
              toast.success("URL copied");
            }}
          >
            Copy URL
          </Button>
        ) : null}
        <ConfirmButton
          size="sm"
          variant="ghost"
          disabled={pending}
          confirmLabel="Delete everywhere?"
          onConfirm={() =>
            startTransition(async () => {
              await deleteAssetAction(asset.id);
              toast.success("Deleted");
              onDeleted();
            })
          }
        >
          Delete
        </ConfirmButton>
      </div>
    </div>
  );
}
