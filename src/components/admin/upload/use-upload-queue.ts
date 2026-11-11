"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  completeUploadAction,
  importFromDriveAction,
  importProgressAction,
  retryImportAction,
} from "@/features/media/actions";
import { uploadFile } from "@/features/media/client/upload";
import type { PickedFile } from "@/features/google/client";

export type QueueSource = "device" | "drive";
export type QueueStatus = "uploading" | "processing" | "done" | "error";

export type QueueItem = {
  key: string;
  name: string;
  source: QueueSource;
  /** 0..1 — bytes sent (device) or bytes transferred server-side (Drive) */
  progress: number;
  status: QueueStatus;
  error?: string;
  assetId?: string;
};

export type UploadQueue = ReturnType<typeof useUploadQueue>;

const POLL_MS = 2500;
let seq = 0;
const nextKey = () => `q${++seq}`;
const message = (e: unknown) => (e instanceof Error ? e.message : "Upload failed");

/**
 * Everything being added to the library, whatever the source. Device files upload from the browser
 * straight to the provider; Drive files transfer server-side and are polled for progress; both then
 * wait for the provider to finish processing (e.g. Mux transcoding). Lives in the page, not the
 * dialog, so closing the dialog doesn't stop anything.
 *
 * `onChange` fires when an item changes state (created, done, failed), so callers can refresh lists.
 */
export function useUploadQueue({ onChange }: { onChange?: () => void } = {}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const files = useRef(new Map<string, File>());
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);

  const patch = useCallback((key: string, p: Partial<QueueItem>) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));
  }, []);

  const runDevice = useCallback(
    async (key: string, file: File) => {
      patch(key, { status: "uploading", progress: 0, error: undefined });
      try {
        const asset = await uploadFile(file, {
          onProgress: (progress) => patch(key, { progress }),
        });
        patch(key, {
          assetId: asset.id,
          progress: 1,
          status:
            asset.status === "READY" ? "done" : asset.status === "ERRORED" ? "error" : "processing",
          error:
            asset.status === "ERRORED"
              ? "The storage provider couldn't process this file."
              : undefined,
        });
      } catch (e) {
        patch(key, { status: "error", error: message(e) });
      }
      changed.current?.();
    },
    [patch],
  );

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      for (const file of Array.from(list)) {
        const key = nextKey();
        files.current.set(key, file);
        setItems((x) => [
          ...x,
          { key, name: file.name, source: "device", progress: 0, status: "uploading" },
        ]);
        void runDevice(key, file);
      }
    },
    [runDevice],
  );

  const addDrive = useCallback(
    async (picked: PickedFile[]) => {
      const rows = picked.map((p) => ({ ...p, key: nextKey() }));
      setItems((x) => [
        ...x,
        ...rows.map((r): QueueItem => ({
          key: r.key,
          name: r.name,
          source: "drive",
          progress: 0,
          status: "uploading",
        })),
      ]);
      try {
        const results = await importFromDriveAction(rows.map((r) => r.id));
        for (const r of rows) {
          const res = results.find((x) => x.fileId === r.id);
          patch(
            r.key,
            res?.assetId
              ? { assetId: res.assetId }
              : { status: "error", error: res?.error ?? "Import failed" },
          );
        }
      } catch (e) {
        for (const r of rows) patch(r.key, { status: "error", error: message(e) });
      }
      changed.current?.();
    },
    [patch],
  );

  const retry = useCallback(
    async (key: string) => {
      const item = items.find((i) => i.key === key);
      if (!item) return;
      const file = files.current.get(key);
      if (item.source === "device" && file) return runDevice(key, file);
      if (item.source === "drive" && item.assetId) {
        patch(key, { status: "uploading", error: undefined });
        try {
          await retryImportAction(item.assetId);
        } catch (e) {
          patch(key, { status: "error", error: message(e) });
        }
        changed.current?.();
      }
    },
    [items, patch, runDevice],
  );

  const dismiss = useCallback((key: string) => {
    files.current.delete(key);
    setItems((list) => list.filter((i) => i.key !== key));
  }, []);

  // Poll what's still moving: Drive transfers (progress) and provider processing (until READY).
  const watching = items.filter(
    (i) =>
      i.assetId &&
      (i.status === "processing" || (i.source === "drive" && i.status === "uploading")),
  );
  const watchKey = watching.map((i) => `${i.key}:${i.status}`).join(",");
  useEffect(() => {
    if (!watching.length) return;
    let busy = false;
    const timer = window.setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        let transitioned = false;
        const importing = watching.filter((i) => i.status === "uploading");
        if (importing.length) {
          const progress = await importProgressAction(importing.map((i) => i.assetId!)).catch(
            () => [],
          );
          for (const p of progress) {
            const item = importing.find((i) => i.assetId === p.assetId);
            if (!item) continue;
            if (p.status === "FAILED") {
              patch(item.key, { status: "error", error: p.error ?? "Import failed" });
              transitioned = true;
            } else if (p.status === "DONE") {
              patch(item.key, { progress: 1, status: "processing" });
              transitioned = true;
            } else {
              patch(item.key, {
                progress: p.bytesTotal ? p.bytesDone / p.bytesTotal : 0,
                error: p.error ?? undefined,
              });
            }
          }
        }
        for (const item of watching.filter((i) => i.status === "processing")) {
          const asset = await completeUploadAction(item.assetId!).catch(() => null);
          if (asset?.status === "READY") {
            patch(item.key, { status: "done" });
            transitioned = true;
          } else if (asset?.status === "ERRORED") {
            patch(item.key, {
              status: "error",
              error: "The storage provider couldn't process this file.",
            });
            transitioned = true;
          }
        }
        if (transitioned) changed.current?.();
      } finally {
        busy = false;
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-subscribe only when the watched set changes
  }, [watchKey]);

  const active = items.filter((i) => i.status === "uploading" || i.status === "processing").length;
  return { items, active, addFiles, addDrive, retry, dismiss };
}
