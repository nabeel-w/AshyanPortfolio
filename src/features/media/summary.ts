import type { Asset, AssetImport } from "@/generated/prisma/client";

export type AssetSummary = {
  id: string;
  kind: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  status: "UPLOADING" | "PROCESSING" | "READY" | "ERRORED";
  provider: string;
  filename: string;
  url: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
  playbackId: string | null;
  duration: number | null;
  bytes: number | null;
  createdAt: string;
  /** Server-side import progress (Google Drive), when the asset came in that way */
  import: {
    status: "RUNNING" | "DONE" | "FAILED";
    bytesDone: number;
    bytesTotal: number;
    error: string | null;
  } | null;
};

/** Serializable view of an Asset for admin UIs (pickers, library). */
export function toAssetSummary(a: Asset & { import?: AssetImport | null }): AssetSummary {
  return {
    id: a.id,
    kind: a.kind,
    status: a.status,
    provider: a.provider,
    filename: a.filename,
    url: a.url,
    alt: a.alt,
    width: a.width,
    height: a.height,
    blurDataUrl: a.blurDataUrl,
    playbackId: a.playbackId,
    duration: a.duration,
    bytes: a.bytes === null ? null : Number(a.bytes),
    createdAt: a.createdAt.toISOString(),
    import: a.import
      ? {
          status: a.import.status,
          bytesDone: Number(a.import.bytesDone),
          bytesTotal: Number(a.import.bytesTotal),
          error: a.import.error,
        }
      : null,
  };
}
