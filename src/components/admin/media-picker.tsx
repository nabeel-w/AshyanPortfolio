"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listAssetsAction } from "@/features/media/actions";
import type { AssetSummary } from "@/features/media/summary";
import { mux } from "@/features/media/delivery";
import { cn } from "@/lib/utils";
import { UploadDialog } from "./upload/upload-dialog";
import { useUploadQueue } from "./upload/use-upload-queue";

export function assetThumb(a: Pick<AssetSummary, "kind" | "url" | "playbackId">) {
  if (a.kind === "VIDEO" && a.playbackId) return mux.poster(a.playbackId, 1, 480);
  return a.url ?? "";
}

/**
 * Pick an asset from the library, or add a new one (device or Google Drive) through the Upload dialog.
 * While that dialog is open the picker steps aside, so only one modal (and the Google Picker) is on screen.
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [, startTransition] = useTransition();

  const load = useCallback(
    () => startTransition(async () => setAssets(await listAssetsAction({ kind, readyOnly: true }))),
    [kind],
  );
  const queue = useUploadQueue({ onChange: load });

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const shown = (assets ?? []).filter(
    (a) => !query || `${a.filename} ${a.alt}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <>
      <Dialog open={open && !uploadOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85dvh] w-[min(96vw,64rem)] max-w-none overflow-hidden sm:max-w-none">
          <DialogHeader>
            <DialogTitle>
              {title ?? (kind === "VIDEO" ? "Choose a video" : "Choose an image")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              aria-label="Search media"
              className="h-9 min-w-48 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
            />
            <Button type="button" variant="outline" onClick={() => setUploadOpen(true)}>
              {queue.active ? `Uploading (${queue.active})…` : "Upload new"}
            </Button>
          </div>
          <div className="-mx-1 overflow-y-auto px-1 pb-2" style={{ maxHeight: "60dvh" }}>
            {assets === null ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
            ) : shown.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nothing ready yet. Upload one; videos appear here once processed.
              </p>
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
                        <img
                          src={assetThumb(a)}
                          alt={a.alt}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      </span>
                      <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">
                        {a.filename}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        queue={queue}
        accept={kind === "VIDEO" ? "video/*" : "image/*"}
        title={kind === "VIDEO" ? "Add a video" : "Add an image"}
      />
    </>
  );
}
