"use server";

import { z } from "zod";
import { invalidate } from "@/features/content/invalidate";
import { requireAdmin } from "@/lib/session";
import * as media from "./service";
import { toAssetSummary } from "./summary";

/** Admin-only entry points used by the browser uploader and (soon) the media library UI. */

const uploadRequest = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  bytes: z.number().int().positive(),
});

export async function createUploadAction(input: z.input<typeof uploadRequest>) {
  await requireAdmin();
  return media.createUpload(uploadRequest.parse(input));
}

export async function completeUploadAction(assetId: string) {
  await requireAdmin();
  const asset = await media.completeUpload(z.string().cuid().parse(assetId));
  if (asset.status === "READY") invalidate.assets();
  return {
    id: asset.id,
    kind: asset.kind,
    status: asset.status,
    url: asset.url,
    playbackId: asset.playbackId,
    width: asset.width,
    height: asset.height,
  };
}

export async function deleteAssetAction(assetId: string) {
  await requireAdmin();
  await media.deleteAsset(z.string().cuid().parse(assetId));
  invalidate.assets();
  invalidate.projects();
  invalidate.clients();
}

export type { AssetSummary } from "./summary";

/** Library listing for the media page and pickers (newest first). */
export async function listAssetsAction(filter: { kind?: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT"; readyOnly?: boolean } = {}) {
  await requireAdmin();
  const { db } = await import("@/lib/db");
  const rows = await db.asset.findMany({
    where: {
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(filter.readyOnly ? { status: "READY" as const } : { status: { not: "UPLOADING" as const } }),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return rows.map(toAssetSummary);
}

const assetPatch = z.object({ alt: z.string().max(300).optional(), caption: z.string().max(500).optional() });

export async function updateAssetAction(assetId: string, patch: z.input<typeof assetPatch>) {
  await requireAdmin();
  const { db } = await import("@/lib/db");
  await db.asset.update({ where: { id: z.string().cuid().parse(assetId) }, data: assetPatch.parse(patch) });
  invalidate.assets();
  invalidate.projects();
}
