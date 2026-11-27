import { MediaConfigError, type MediaKind, type StorageProvider } from "../types";
import { local } from "./local";
import { vercelBlob } from "./vercel-blob";

/**
 * Every available provider: Vercel Blob in production, local disk in development. Films are YouTube
 * links (no hosting), so only images, logos and short hover loops are stored (docs/03).
 * To add one: implement StorageProvider in this folder and list it here.
 */
export const providers: readonly StorageProvider[] = [local, vercelBlob];

export function getProvider(id: string): StorageProvider {
  const p = providers.find((x) => x.id === id);
  if (!p)
    throw new MediaConfigError(
      `Unknown media provider "${id}". Known: ${providers.map((x) => x.id).join(", ")}`,
    );
  return p;
}

export function missingEnv(p: StorageProvider): string[] {
  return p.requiredEnv.filter((name) => !process.env[name]);
}

/**
 * Which provider handles each kind, from env:
 *   MEDIA_VIDEO_PROVIDER  → VIDEO
 *   MEDIA_IMAGE_PROVIDER  → IMAGE
 *   MEDIA_FILE_PROVIDER   → AUDIO + DOCUMENT (defaults to the image provider)
 * Nothing set → "local" in development (zero setup), an error in production.
 */
export function providerIdFor(kind: MediaKind): string {
  const image = process.env.MEDIA_IMAGE_PROVIDER || undefined;
  const fromEnv =
    kind === "VIDEO"
      ? process.env.MEDIA_VIDEO_PROVIDER || image
      : kind === "IMAGE"
        ? image
        : process.env.MEDIA_FILE_PROVIDER || image;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== "production") return local.id;
  throw new MediaConfigError(
    `No storage provider configured for ${kind}. Set MEDIA_${kind === "VIDEO" ? "VIDEO" : kind === "IMAGE" ? "IMAGE" : "FILE"}_PROVIDER (see .env.example).`,
  );
}

/** The ready-to-use provider for a kind, or a clear error saying exactly which env vars are missing. */
export function providerFor(kind: MediaKind): StorageProvider {
  const p = getProvider(providerIdFor(kind));
  if (!p.kinds.includes(kind)) {
    throw new MediaConfigError(
      `Provider "${p.id}" can't store ${kind} files (it handles ${p.kinds.join(", ")}).`,
    );
  }
  const missing = missingEnv(p);
  if (missing.length) {
    throw new MediaConfigError(
      `Provider "${p.id}" is missing env: ${missing.join(", ")}. ${p.setup}`,
    );
  }
  return p;
}
