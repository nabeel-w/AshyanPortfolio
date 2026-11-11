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
export type UploadTicket = {
  assetId: string;
  kind: MediaKind;
  provider: string;
  upload: UploadInstruction;
};

/** Same type + size rules for every way a file gets in (browser upload, Drive import). */
export function validateUpload(mimeType: string, bytes: number): MediaKind {
  const kind = kindFromMime(mimeType);
  if (!kind) throw new Error(`Unsupported file type: ${mimeType || "unknown"}`);
  if (bytes <= 0 || bytes > maxBytes(kind)) {
    throw new Error(
      `${kind.toLowerCase()} files must be under ${Math.round(maxBytes(kind) / 1024 / 1024)} MB`,
    );
  }
  return kind;
}

export async function createUpload({
  filename,
  mimeType,
  bytes,
}: UploadRequest): Promise<UploadTicket> {
  const kind = validateUpload(mimeType, bytes);
  const provider = providerFor(kind);
  const key = makeKey(kind, filename);
  const { providerKey, upload } = await provider.createUpload({
    key,
    filename,
    mimeType,
    bytes,
    kind,
  });

  const asset = await db.asset.create({
    data: {
      kind,
      provider: provider.id,
      providerKey,
      status: "UPLOADING",
      filename,
      mimeType,
      bytes,
    },
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
    bytes: result.bytes === undefined ? undefined : BigInt(result.bytes),
    meta: result.meta as Prisma.InputJsonValue | undefined,
  };
}

/** Ask the provider what happened to the upload and persist it. Safe to call repeatedly (polling). */
export async function completeUpload(assetId: string) {
  const asset = await db.asset.findUniqueOrThrow({ where: { id: assetId } });
  const provider = getProvider(asset.provider);
  const result = await provider.finalize(asset.providerKey, asset.kind);
  const image =
    asset.kind === "IMAGE" ? await enrichImage(provider, asset.providerKey, result) : {};
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

/**
 * Server-side upload of an in-memory file through the same provider pipeline the browser uses
 * (seeding, imports). Streaming video may come back PROCESSING — poll `completeUpload` or rely on the webhook.
 */
export async function ingest(
  file: Buffer,
  meta: { filename: string; mimeType: string; alt?: string },
) {
  const ticket = await createUpload({
    filename: meta.filename,
    mimeType: meta.mimeType,
    bytes: file.length,
  });
  const body = new Uint8Array(file);
  const { upload } = ticket;
  if (upload.strategy === "put") {
    const url = upload.url.startsWith("/")
      ? `${process.env.NEXT_PUBLIC_SITE_URL}${upload.url}`
      : upload.url;
    await expectOk(
      await fetch(url, {
        method: "PUT",
        body,
        headers: { "Content-Type": meta.mimeType, ...upload.headers },
      }),
      "ingest PUT",
    );
  } else if (upload.strategy === "form-post") {
    const form = new FormData();
    form.append(upload.fieldName, new Blob([body], { type: meta.mimeType }), meta.filename);
    await expectOk(await fetch(upload.url, { method: "POST", body: form }), "ingest POST");
  } else {
    const { put } = await import("@vercel/blob/client");
    await put(upload.pathname, new Blob([body], { type: meta.mimeType }), {
      access: "public",
      token: upload.token,
      contentType: upload.contentType,
    });
  }
  if (meta.alt) await db.asset.update({ where: { id: ticket.assetId }, data: { alt: meta.alt } });
  return completeUpload(ticket.assetId);
}

/** Remove from the provider first, then the DB row (relations are SetNull / Cascade in the schema). */
export async function deleteAsset(assetId: string) {
  const asset = await db.asset.findUniqueOrThrow({
    where: { id: assetId },
    include: { import: true },
  });
  const provider = getProvider(asset.provider);
  // A half-finished server import holds a multipart upload / session at the provider: drop it too.
  if (asset.import && asset.import.status !== "DONE") {
    await provider.importer
      ?.abort?.({
        providerKey: asset.providerKey,
        state: (asset.import.state ?? {}) as Record<string, unknown>,
        total: Number(asset.import.bytesTotal),
        mimeType: asset.mimeType,
        filename: asset.filename,
      })
      .catch((e) => console.warn(`[media] aborting import of ${assetId} failed:`, e));
  }
  await provider.delete(asset.providerKey).catch((e) => {
    // Nothing was ever stored for an import that never completed.
    if (!asset.import || asset.import.status === "DONE") throw e;
  });
  await db.asset.delete({ where: { id: assetId } });
}
