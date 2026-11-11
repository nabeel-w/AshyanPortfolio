import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { MediaKind } from "./types";

const MIME_KIND: [RegExp, MediaKind][] = [
  [/^image\/(jpeg|png|webp|avif|gif|svg\+xml)$/, "IMAGE"],
  [/^video\/(mp4|quicktime|webm|x-matroska|x-m4v)$/, "VIDEO"],
  [/^audio\/(mpeg|mp4|wav|x-wav|aac|ogg|flac)$/, "AUDIO"],
  [/^application\/pdf$/, "DOCUMENT"],
];

export function kindFromMime(mimeType: string): MediaKind | null {
  return MIME_KIND.find(([re]) => re.test(mimeType))?.[1] ?? null;
}

/** Max upload size per kind in bytes. Override with MEDIA_MAX_<KIND>_MB. */
export function maxBytes(kind: MediaKind): number {
  const defaults: Record<MediaKind, number> = { IMAGE: 50, VIDEO: 10_000, AUDIO: 500, DOCUMENT: 50 };
  const mb = Number(process.env[`MEDIA_MAX_${kind}_MB`] ?? defaults[kind]);
  return mb * 1024 * 1024;
}

/** "image/2026/11/hero-still-k3j2x9.webp" — readable, unique, URL-safe. */
export function makeKey(kind: MediaKind, filename: string, now = new Date()): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot > 0 ? filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
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

/** Parse "t=123,v1=abc" / "time=123,sig1=abc" style signature headers. */
export function parseSigHeader(header: string | null): Record<string, string> {
  return Object.fromEntries(
    (header ?? "")
      .split(",")
      .map((part) => part.trim().split("="))
      .filter((kv): kv is [string, string] => kv.length === 2 && !!kv[0] && !!kv[1]),
  );
}

/** Reject webhooks older than 5 minutes (replay protection). */
export function freshTimestamp(seconds: string | undefined, toleranceSec = 300): boolean {
  const t = Number(seconds);
  return Number.isFinite(t) && Math.abs(Date.now() / 1000 - t) <= toleranceSec;
}

export async function expectOk(res: Response, what: string): Promise<Response> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${what} failed: ${res.status} ${res.statusText} ${body.slice(0, 300)}`);
  }
  return res;
}
