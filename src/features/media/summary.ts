import type { Asset } from "@/generated/prisma/client";

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
};

/** Serializable view of an Asset for admin UIs (pickers, library). */
export function toAssetSummary(a: Asset): AssetSummary {
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
    bytes: a.bytes,
    createdAt: a.createdAt.toISOString(),
  };
}
