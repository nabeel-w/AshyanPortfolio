"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  completeUploadAction,
  deleteAssetAction,
  importProgressAction,
  listAssetsAction,
  retryImportAction,
  updateAssetAction,
} from "@/features/media/actions";
import { clockDuration } from "@/features/media/delivery";
import type { AssetSummary } from "@/features/media/summary";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "./confirm-button";
import { assetThumb } from "./media-picker";
import { UploadDialog } from "./upload/upload-dialog";
import { useUploadQueue } from "./upload/use-upload-queue";

const KINDS = ["ALL", "IMAGE", "VIDEO", "DOCUMENT"] as const;

/** Media library: Add media (device / Google Drive), grid with live import progress, alt text, delete. */
export function MediaLibrary({
  initial,
  openUpload = false,
}: {
  initial: AssetSummary[];
  openUpload?: boolean;
}) {
  const [assets, setAssets] = useState(initial);
  const [filter, setFilter] = useState<(typeof KINDS)[number]>("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(openUpload);
  const [, startTransition] = useTransition();

  const refresh = useCallback(
    () => startTransition(async () => setAssets(await listAssetsAction())),
    [],
  );
  const queue = useUploadQueue({ onChange: refresh });

  // Streaming video is transcoded at the provider and Drive imports fill server-side.
  // Webhooks can't reach localhost, so poll while anything is still moving.
  const processing = assets.filter((a) => a.status === "PROCESSING").map((a) => a.id);
  const importing = assets.filter((a) => a.import?.status === "RUNNING").map((a) => a.id);
  const moving = [...processing, ...importing].join(",");
  useEffect(() => {
    if (!moving) return;
    const t = setInterval(
      async () => {
        if (importing.length) await importProgressAction(importing).catch(() => null);
        for (const id of processing) await completeUploadAction(id).catch(() => null);
        refresh();
      },
      importing.length ? 2500 : 4000,
    );
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-subscribe only when the moving set changes
  }, [moving]);

  const shown = assets.filter((a) => filter === "ALL" || a.kind === filter);
  const current = assets.find((a) => a.id === selected) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setUploadOpen(true)}>Upload</Button>
        {queue.active ? (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="text-sm text-muted-foreground hover:text-ivory"
          >
            {queue.active} in progress…
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">
            From this device or Google Drive. Images go to the image store, video to the video host.
          </p>
        )}
      </div>
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} queue={queue} />

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => setFilter(k)}
          >
            {k === "ALL" ? "All" : k[0] + k.slice(1).toLowerCase() + "s"}
          </Button>
        ))}
        <span className="ml-auto self-center text-xs text-muted-foreground">
          {shown.length} files
        </span>
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
                    <img
                      src={assetThumb(a)}
                      alt={a.alt}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <TileStatus asset={a} />
                  )}
                  {a.kind === "VIDEO" && a.duration ? (
                    <span className="absolute right-1 bottom-1 rounded bg-ink/80 px-1.5 text-[10px] text-ivory">
                      ▶ {clockDuration(a.duration)}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="truncate text-xs text-muted-foreground">{a.filename}</span>
                  {!a.alt && a.kind === "IMAGE" ? (
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-red"
                      title="Missing alt text"
                    />
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <aside className="xl:sticky xl:top-8 xl:self-start">
          {current ? (
            <AssetPanel
              key={current.id}
              asset={current}
              onChanged={refresh}
              onDeleted={() => (setSelected(null), refresh())}
            />
          ) : (
            <p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
              Select a file to edit its alt text or delete it.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Placeholder for a tile that isn't READY: import progress, processing, or the failure. */
function TileStatus({ asset }: { asset: AssetSummary }) {
  const job = asset.import;
  if (job?.status === "RUNNING") {
    const pct = job.bytesTotal ? Math.round((job.bytesDone / job.bytesTotal) * 100) : 0;
    return (
      <span className="flex size-full flex-col justify-end gap-1.5 p-2 text-[10px] text-muted-foreground">
        <span>Importing from Drive · {pct}%</span>
        <span
          className="block h-0.5 bg-ink"
          role="progressbar"
          aria-label={`${asset.filename} import`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="block h-full bg-red transition-[width]" style={{ width: `${pct}%` }} />
        </span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "grid size-full place-items-center text-xs",
        asset.status === "ERRORED" ? "text-red-bright" : "text-muted-foreground",
      )}
    >
      {asset.status === "ERRORED" ? "failed" : `${asset.status.toLowerCase()}…`}
    </span>
  );
}

function AssetPanel({
  asset,
  onChanged,
  onDeleted,
}: {
  asset: AssetSummary;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [alt, setAlt] = useState(asset.alt);
  const [pending, startTransition] = useTransition();
  const failedImport = asset.import?.status === "FAILED";
  return (
    <div className="space-y-4 rounded-md border border-border bg-onyx p-4">
      {asset.status === "READY" ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview
        <img src={assetThumb(asset)} alt="" className="aspect-video w-full rounded object-cover" />
      ) : (
        <div className="aspect-video w-full overflow-hidden rounded bg-graphite">
          <TileStatus asset={asset} />
        </div>
      )}
      {failedImport ? (
        <div className="space-y-2 rounded-md border border-oxblood p-3 text-xs">
          <p className="text-red-bright">{asset.import?.error ?? "The import failed."}</p>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await retryImportAction(asset.id);
                toast.success("Import restarted from where it stopped");
                onChanged();
              })
            }
          >
            Retry import
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{asset.kind.toLowerCase()}</Badge>
        <Badge variant="outline">{asset.provider}</Badge>
        <Badge variant={asset.status === "READY" ? "secondary" : "outline"}>
          {asset.status.toLowerCase()}
        </Badge>
        {asset.width ? (
          <Badge variant="outline">
            {asset.width}×{asset.height}
          </Badge>
        ) : null}
        {asset.bytes ? (
          <Badge variant="outline">{(asset.bytes / 1024 / 1024).toFixed(1)} MB</Badge>
        ) : null}
      </div>
      <p className="truncate text-sm text-ivory">{asset.filename}</p>
      <label className="block text-xs text-muted-foreground">
        Alt text{" "}
        {asset.kind === "IMAGE" ? "(describe the image for screen readers and search)" : ""}
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
