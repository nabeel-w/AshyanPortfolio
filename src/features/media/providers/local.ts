import { mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "../types";
import { hmac } from "../util";

/**
 * Local disk — development only. Zero setup: files land in public/uploads and are served by Next.
 * Uploads go through a signed, expiring URL handled by app/api/media/local/[...key]/route.ts,
 * mirroring how real presigned URLs behave. Videos are served as-is (no transcoding).
 */
export const LOCAL_ROOT = path.join(process.cwd(), "public", "uploads");
const URL_TTL_SECONDS = 15 * 60;

function secret() {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is required to sign local upload URLs");
  return s;
}

export function localSignature(key: string, expires: number): string {
  return hmac(secret(), `local-upload:${key}:${expires}`);
}

/** Resolve a key inside LOCAL_ROOT, refusing anything that escapes it. */
export function localPath(key: string): string {
  const full = path.resolve(LOCAL_ROOT, key);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid key");
  return full;
}

function assertDev() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      'The "local" media provider is for development only. Configure a real provider for production.',
    );
  }
}

export const local: StorageProvider = {
  id: "local",
  label: "Local disk (dev)",
  kinds: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"],
  requiredEnv: ["BETTER_AUTH_SECRET"],
  setup: "No setup — development only. Files are written to public/uploads (gitignored).",

  async createUpload({ key }) {
    assertDev();
    const expires = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
    const url = `/api/media/local/${key}?expires=${expires}&sig=${localSignature(key, expires)}`;
    return { providerKey: key, upload: { strategy: "put", url } };
  },

  async finalize(key) {
    const info = await stat(localPath(key)).catch(() => null);
    if (!info) return { status: "ERRORED", meta: { error: "File not found after upload" } };
    const url = `/uploads/${key}`;
    return { status: "READY", url, bytes: info.size, meta: { mp4: url } };
  },

  async delete(key) {
    await rm(localPath(key), { force: true });
  },

  async read(key) {
    return readFile(localPath(key));
  },

  async check() {
    assertDev();
    await mkdir(LOCAL_ROOT, { recursive: true });
    return `writing to ${path.relative(process.cwd(), LOCAL_ROOT)}`;
  },

  // Server imports write each chunk at its offset (idempotent, so retries are safe).
  importer: {
    async begin({ key }) {
      assertDev();
      const file = localPath(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "");
      return { providerKey: key, state: {} };
    },
    async part({ providerKey, offset }, bytes) {
      const handle = await open(localPath(providerKey), "r+");
      try {
        await handle.write(bytes, 0, bytes.byteLength, offset);
      } finally {
        await handle.close();
      }
      return {};
    },
    async complete() {},
    async abort({ providerKey }) {
      await rm(localPath(providerKey), { force: true });
    },
  },
};
