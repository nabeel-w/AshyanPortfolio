import {
  completeMultipartUpload,
  createMultipartUpload,
  del,
  head,
  list,
  type Part,
  uploadPart,
} from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import type { StorageProvider } from "../types";
import { expectOk } from "../util";

/**
 * Vercel Blob (public store). The browser uploads straight to Blob with a short-lived token scoped to
 * one pathname, content type and size — no file bytes pass through our functions (4.5 MB body limit).
 */
const TOKEN_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX_AGE = 60 * 60 * 24 * 365; // keys are unique per upload → safe to cache for a year

export const vercelBlob: StorageProvider = {
  id: "vercel-blob",
  label: "Vercel Blob",
  kinds: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"],
  requiredEnv: ["BLOB_READ_WRITE_TOKEN"],
  setup:
    "Create a public Blob store in the Vercel dashboard (Storage → Blob) and pull BLOB_READ_WRITE_TOKEN with `vercel env pull`.",

  async createUpload({ key, mimeType, bytes }) {
    const token = await generateClientTokenFromReadWriteToken({
      pathname: key,
      allowedContentTypes: [mimeType],
      maximumSizeInBytes: bytes,
      validUntil: Date.now() + TOKEN_TTL_MS,
      addRandomSuffix: false,
      cacheControlMaxAge: CACHE_MAX_AGE,
    });
    return {
      providerKey: key,
      upload: { strategy: "vercel-blob", pathname: key, token, contentType: mimeType },
    };
  },

  async finalize(key) {
    const blob = await head(key).catch(() => null);
    if (!blob) return { status: "ERRORED", meta: { error: "Blob not found after upload" } };
    return { status: "READY", url: blob.url, bytes: blob.size, meta: { mp4: blob.url } };
  },

  async delete(key) {
    await del(key);
  },

  async read(key) {
    const blob = await head(key);
    const res = await expectOk(await fetch(blob.url), "Blob download");
    return Buffer.from(await res.arrayBuffer());
  },

  async check() {
    const { blobs } = await list({ limit: 1 });
    return `store reachable (${blobs.length ? "has files" : "empty"})`;
  },

  // Server imports: Blob multipart upload, one part per chunk (≥ 5 MB, equal size except the last).
  importer: {
    async begin({ key, mimeType }) {
      const { key: blobKey, uploadId } = await createMultipartUpload(key, {
        access: "public",
        contentType: mimeType,
        addRandomSuffix: false,
        cacheControlMaxAge: CACHE_MAX_AGE,
      });
      return { providerKey: key, state: { key: blobKey, uploadId, parts: [] } };
    },
    async part({ providerKey, state, partNumber }, bytes) {
      const part = await uploadPart(
        providerKey,
        Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        {
          access: "public",
          key: String(state.key),
          uploadId: String(state.uploadId),
          partNumber,
          addRandomSuffix: false,
        },
      );
      const parts = ((state.parts as Part[] | undefined) ?? []).filter(
        (x) => x.partNumber !== partNumber,
      );
      return { state: { ...state, parts: [...parts, { partNumber, etag: part.etag }] } };
    },
    async complete({ providerKey, state, mimeType }) {
      const parts = [...(state.parts as Part[])].sort((a, b) => a.partNumber - b.partNumber);
      await completeMultipartUpload(providerKey, parts, {
        access: "public",
        key: String(state.key),
        uploadId: String(state.uploadId),
        contentType: mimeType,
        addRandomSuffix: false,
        cacheControlMaxAge: CACHE_MAX_AGE,
      });
    },
  },
};
