import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { MediaKind } from "./types";

export { kindFromMime } from "./mime";

/** Max upload size per kind in bytes. Override with MEDIA_MAX_<KIND>_MB. */
export function maxBytes(kind: MediaKind): number {
  const defaults: Record<MediaKind, number> = {
    IMAGE: 50,
    VIDEO: 10_000,
    AUDIO: 500,
    DOCUMENT: 50,
  };
  const mb = Number(process.env[`MEDIA_MAX_${kind}_MB`] ?? defaults[kind]);
  return mb * 1024 * 1024;
}

/** Hover loops: short muted MP4/WebM clips on the grid (#26). Override the cap with MEDIA_MAX_LOOP_MB. */
export const LOOP_MIME_TYPES = ["video/mp4", "video/webm"] as const;
export function maxLoopBytes(): number {
  return Number(process.env.MEDIA_MAX_LOOP_MB || 20) * 1024 * 1024;
}

/** Why a file is being added; it tightens the rules (a loop must be a small MP4/WebM). */
export type UploadPurpose = "loop";

/** "image/2026/11/hero-still-k3j2x9.webp" — readable, unique, URL-safe. */
export function makeKey(kind: MediaKind, filename: string, now = new Date()): string {
  const dot = filename.lastIndexOf(".");
  const ext =
    dot > 0
      ? filename
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
      : "bin";
  const base =
    (dot > 0 ? filename.slice(0, dot) : filename)
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "file";
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${kind.toLowerCase()}/${now.getUTCFullYear()}/${month}/${base}-${randomBytes(4).toString("hex")}.${ext}`;
}

/** HMAC-SHA256 hex. */
export function hmac(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

export async function expectOk(res: Response, what: string): Promise<Response> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${what} failed: ${res.status} ${res.statusText} ${body.slice(0, 300)}`);
  }
  return res;
}
