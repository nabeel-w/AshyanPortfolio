"use server";

import { z } from "zod";
import { invalidate } from "@/features/content/invalidate";
import { requireAdmin } from "@/lib/session";
import * as media from "./service";

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
