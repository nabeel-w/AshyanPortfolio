"use server";

import { z } from "zod";
import { invalidate } from "@/features/content/invalidate";
import { googleAccountFor } from "@/features/google/accounts";
import { requireAdmin } from "@/lib/session";
import * as imports from "./import";
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
export async function listAssetsAction(
  filter: { kind?: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT"; readyOnly?: boolean } = {},
) {
  await requireAdmin();
  const { db } = await import("@/lib/db");
  const rows = await db.asset.findMany({
    where: {
      ...(filter.kind ? { kind: filter.kind } : {}),
      // Browser uploads still UPLOADING are hidden (they may be abandoned); server imports show with progress.
      ...(filter.readyOnly
        ? { status: "READY" as const }
        : { OR: [{ status: { not: "UPLOADING" as const } }, { import: { isNot: null } }] }),
    },
    include: { import: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return rows.map(toAssetSummary);
}

const assetPatch = z.object({
  alt: z.string().max(300).optional(),
  caption: z.string().max(500).optional(),
});

export async function updateAssetAction(assetId: string, patch: z.input<typeof assetPatch>) {
  await requireAdmin();
  const { db } = await import("@/lib/db");
  await db.asset.update({
    where: { id: z.string().cuid().parse(assetId) },
    data: assetPatch.parse(patch),
  });
  invalidate.assets();
  invalidate.projects();
}

// ─── Google Drive imports (docs/03 "Import sources") ─────────────────────────

const driveIds = z
  .array(z.string().regex(/^[A-Za-z0-9_-]{10,200}$/))
  .min(1)
  .max(50);

export type DriveImportResult = { fileId: string; assetId?: string; error?: string };

/** Import files the admin just picked in the Google Picker. Each becomes an UPLOADING asset that fills server-side. */
export async function importFromDriveAction(fileIds: string[]): Promise<DriveImportResult[]> {
  const session = await requireAdmin();
  const ids = driveIds.parse(fileIds);
  const account = await googleAccountFor("drive", session.user.id);
  if (!account) throw new Error("Connect Google Drive first.");
  const results: DriveImportResult[] = [];
  for (const fileId of ids) {
    try {
      const assetId = await imports.createDriveImport(account.id, fileId);
      await imports.kickImport(assetId);
      results.push({ fileId, assetId });
    } catch (e) {
      results.push({ fileId, error: e instanceof Error ? e.message : "Import failed" });
    }
  }
  invalidate.assets();
  return results;
}

const assetIds = z.array(z.string().cuid()).max(100);

/** Poll import progress (and re-kick stalled imports). */
export async function importProgressAction(ids: string[]) {
  await requireAdmin();
  const progress = await imports.importProgress(assetIds.parse(ids));
  if (progress.some((p) => p.status !== "RUNNING")) invalidate.assets();
  return progress;
}

export async function retryImportAction(assetId: string) {
  await requireAdmin();
  await imports.retryImport(z.string().cuid().parse(assetId));
  invalidate.assets();
}
