import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getProvider, providerFor } from "./providers";
import type { MediaKind, ProviderResult, StorageProvider, UploadInstruction } from "./types";
import { analyzeImage } from "./image-meta";
import { expectOk, kindFromMime, makeKey, maxBytes } from "./util";

/**
 * The upload pipeline, provider-agnostic. Auth is NOT checked here — callers are
 * admin Server Actions (actions.ts) or signature-verified webhooks.
 *
 *   createUpload → browser uploads directly to the provider → completeUpload
 *   (streaming video may stay PROCESSING until the provider's webhook calls applyWebhook)
 */

export type UploadRequest = { filename: string; mimeType: string; bytes: number };
export type UploadTicket = { assetId: string; kind: MediaKind; provider: string; upload: UploadInstruction };

export async function createUpload({ filename, mimeType, bytes }: UploadRequest): Promise<UploadTicket> {
  const kind = kindFromMime(mimeType);
  if (!kind) throw new Error(`Unsupported file type: ${mimeType || "unknown"}`);
  if (bytes <= 0 || bytes > maxBytes(kind)) {
    throw new Error(`${kind.toLowerCase()} files must be under ${Math.round(maxBytes(kind) / 1024 / 1024)} MB`);
  }

  const provider = providerFor(kind);
  const key = makeKey(kind, filename);
  const { providerKey, upload } = await provider.createUpload({ key, filename, mimeType, bytes, kind });

  const asset = await db.asset.create({
    data: { kind, provider: provider.id, providerKey, status: "UPLOADING", filename, mimeType, bytes },
  });
  return { assetId: asset.id, kind, provider: provider.id, upload };
}

async function enrichImage(provider: StorageProvider, providerKey: string, result: ProviderResult) {
  if (result.status !== "READY") return {};
  try {
    const bytes = provider.read
      ? await provider.read(providerKey)
      : Buffer.from(await (await expectOk(await fetch(result.url!), "download")).arrayBuffer());
    return await analyzeImage(bytes);
  } catch (e) {
    // Non-fatal: the image still works without a placeholder.
    console.warn(`[media] image analysis failed for ${providerKey}:`, e);
    return {};
  }
}

function toUpdate(result: ProviderResult): Prisma.AssetUpdateInput {
  return {
    status: result.status,
    url: result.url,
    playbackId: result.playbackId,
    duration: result.duration,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    meta: result.meta as Prisma.InputJsonValue | undefined,
  };
}

/** Ask the provider what happened to the upload and persist it. Safe to call repeatedly (polling). */
export async function completeUpload(assetId: string) {
  const asset = await db.asset.findUniqueOrThrow({ where: { id: assetId } });
  const provider = getProvider(asset.provider);
  const result = await provider.finalize(asset.providerKey, asset.kind);
  const image = asset.kind === "IMAGE" ? await enrichImage(provider, asset.providerKey, result) : {};
  return db.asset.update({ where: { id: assetId }, data: { ...toUpdate(result), ...image } });
}

/** Verify + apply a provider webhook. Returns the updated asset, or null if the event was ignored. */
export async function applyWebhook(providerId: string, request: Request) {
  const provider = getProvider(providerId);
  if (!provider.webhook) throw new Error(`Provider "${providerId}" has no webhook handler`);
  const update = await provider.webhook(request);
  if (!update) return null;
  const asset = await db.asset.findUnique({
    where: { provider_providerKey: { provider: provider.id, providerKey: update.providerKey } },
  });
  if (!asset) return null; // upload created outside this app
  return db.asset.update({ where: { id: asset.id }, data: toUpdate(update.result) });
}

/** Remove from the provider first, then the DB row (relations are SetNull / Cascade in the schema). */
export async function deleteAsset(assetId: string) {
  const asset = await db.asset.findUniqueOrThrow({ where: { id: assetId } });
  await getProvider(asset.provider).delete(asset.providerKey);
  await db.asset.delete({ where: { id: assetId } });
}
