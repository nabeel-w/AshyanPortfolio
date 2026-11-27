import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getProvider, providerFor } from "./providers";
import type { MediaKind, ProviderResult, StorageProvider, UploadInstruction } from "./types";
import { analyzeImage } from "./image-meta";
import type { MediaProbe } from "./probe";
import {
  expectOk,
  kindFromMime,
  LOOP_MIME_TYPES,
  makeKey,
  maxBytes,
  maxLoopBytes,
  type UploadPurpose,
} from "./util";

/**
 * The upload pipeline, provider-agnostic. Auth is NOT checked here — callers are admin Server
 * Actions (actions.ts), the signed import route and scripts.
 *
 *   createUpload → browser uploads directly to the provider → completeUpload (READY)
 */

export type UploadRequest = { filename: string; mimeType: string; bytes: number; purpose?: UploadPurpose };
export type UploadTicket = {
  assetId: string;
  kind: MediaKind;
  provider: string;
  upload: UploadInstruction;
};

/** Same type + size rules for every way a file gets in (browser upload, Drive import). */
export function validateUpload(mimeType: string, bytes: number, purpose?: UploadPurpose): MediaKind {
  const kind = kindFromMime(mimeType);
  if (!kind) throw new Error(`Unsupported file type: ${mimeType || "unknown"}`);
  if (purpose === "loop") {
    if (!(LOOP_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new Error("A hover loop must be an MP4 (H.264) or WebM file.");
    }
    if (bytes <= 0 || bytes > maxLoopBytes()) {
      throw new Error(`Hover loops must be under ${Math.round(maxLoopBytes() / 1024 / 1024)} MB (aim for 2–4 MB).`);
    }
    return kind;
  }
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
  purpose,
}: UploadRequest): Promise<UploadTicket> {
  const kind = validateUpload(mimeType, bytes, purpose);
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
    duration: result.duration,
    width: result.width,
    height: result.height,
    bytes: result.bytes === undefined ? undefined : BigInt(result.bytes),
    meta: result.meta as Prisma.InputJsonValue | undefined,
  };
}

/**
 * Ask the provider what happened to the upload and persist it. Safe to call repeatedly (polling).
 * `probe` fills width/height/duration the provider didn't report (Blob stores none for videos).
 */
export async function completeUpload(assetId: string, probe: MediaProbe = {}) {
  const asset = await db.asset.findUniqueOrThrow({ where: { id: assetId } });
  const provider = getProvider(asset.provider);
  const result = await provider.finalize(asset.providerKey, asset.kind);
  const image =
    asset.kind === "IMAGE" ? await enrichImage(provider, asset.providerKey, result) : {};
  const shape =
    asset.kind === "VIDEO"
      ? {
          width: result.width ?? probe.width ?? undefined,
          height: result.height ?? probe.height ?? undefined,
          duration: result.duration ?? probe.duration ?? undefined,
        }
      : {};
  return db.asset.update({
    where: { id: assetId },
    data: { ...toUpdate(result), ...shape, ...image },
  });
}

/**
 * Server-side upload of an in-memory file through the same provider pipeline the browser uses
 * (seeding, one-off migrations).
 */
export async function ingest(
  file: Buffer,
  meta: { filename: string; mimeType: string; alt?: string; purpose?: UploadPurpose; probe?: MediaProbe },
) {
  const ticket = await createUpload({
    filename: meta.filename,
    mimeType: meta.mimeType,
    bytes: file.length,
    purpose: meta.purpose,
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
  } else {
    const { put } = await import("@vercel/blob/client");
    await put(upload.pathname, new Blob([body], { type: meta.mimeType }), {
      access: "public",
      token: upload.token,
      contentType: upload.contentType,
    });
  }
  if (meta.alt) await db.asset.update({ where: { id: ticket.assetId }, data: { alt: meta.alt } });
  return completeUpload(ticket.assetId, meta.probe);
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
