"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listAssetsAction } from "@/features/media/actions";
import type { AssetSummary } from "@/features/media/summary";
import { uploadFile } from "@/features/media/client/upload";
import { mux } from "@/features/media/delivery";
import { cn } from "@/lib/utils";

export function assetThumb(a: Pick<AssetSummary, "kind" | "url" | "playbackId">) {
  if (a.kind === "VIDEO" && a.playbackId) return mux.poster(a.playbackId, 1, 480);
  return a.url ?? "";
}

/**
 * Pick an asset from the library (or upload a new one right here).
 * `kind` limits the list; only READY assets can be chosen.
 */
export function MediaPicker({
  open,
  onOpenChange,
  kind,
  onPick,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "IMAGE" | "VIDEO";
  onPick: (asset: AssetSummary) => void;
  title?: string;
}) {
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => startTransition(async () => setAssets(await listAssetsAction({ kind, readyOnly: true })));

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind]);

  async function onUpload(file: File) {
    setError(null);
    setUploading(0);
    try {
      let asset = await uploadFile(file, { onProgress: setUploading });
      // Streaming video finishes processing at the provider; poll briefly so it can be picked right away.
      for (let i = 0; asset.status === "PROCESSING" && i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const { completeUploadAction } = await import("@/features/media/actions");
        asset = await completeUploadAction(asset.id);
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  const shown = (assets ?? []).filter((a) => !query || `${a.filename} ${a.alt}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] w-[min(96vw,64rem)] max-w-none overflow-hidden sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{title ?? (kind === "VIDEO" ? "Choose a video" : "Choose an image")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-9 min-w-48 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
          />
          <input
            ref={fileRef}
            type="file"
            hidden
            accept={kind === "VIDEO" ? "video/*" : "image/*"}
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
          <Button type="button" variant="outline" disabled={uploading !== null} onClick={() => fileRef.current?.click()}>
            {uploading !== null ? `Uploading ${Math.round(uploading * 100)}%` : "Upload new"}
          </Button>
        </div>
        {error ? <p className="text-sm text-red-bright">{error}</p> : null}
        <div className="-mx-1 overflow-y-auto px-1 pb-2" style={{ maxHeight: "60dvh" }}>
          {assets === null ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nothing here yet — upload one.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(a);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "group block w-full overflow-hidden rounded-md border border-border text-left transition-colors hover:border-red",
                    )}
                  >
                    <span className="relative block aspect-video bg-graphite">
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails, any provider host */}
                      <img src={assetThumb(a)} alt={a.alt} loading="lazy" className="size-full object-cover" />
                    </span>
                    <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">{a.filename}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
