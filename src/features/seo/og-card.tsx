import "server-only";
import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import sharp from "sharp";
import { absoluteUrl } from "@/lib/site-url";
import { loadGoogleFont } from "./og-font";

/**
 * Shared plumbing for Open Graph cards (rendered by og-template.tsx):
 *  - inputs (background still, font subsets, monogram) are fetched once and cached ("use cache"),
 *    so a crawler gets the card in milliseconds instead of re-fetching everything per request;
 *  - output is a ~100 KB JPEG, not a ~700 KB PNG. WhatsApp ignores preview images over ~300 KB,
 *    and every chat app loads it faster. The admin preview uses the same encoder settings.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/jpeg";

export const OG_COLORS = {
  ink: "#0a0a0a",
  ivory: "#f4f1ec",
  smoke: "#8c8984",
  red: "#c1121f",
  signal: "#f23a45",
} as const;

/**
 * Remote or site-relative image → cover-cropped JPEG data URL (Satori can't decode WebP/AVIF).
 * The focal point (0–1) stays in frame; the centre uses sharp's own cover crop. All args are the cache key.
 */
export async function ogBackground(
  src: string,
  width = OG_SIZE.width,
  height = OG_SIZE.height,
  focalX = 0.5,
  focalY = 0.5,
): Promise<string | null> {
  "use cache";
  cacheLife("max");
  const url = src.startsWith("http") ? src : absoluteUrl(src);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const jpeg = await (await coverCrop(Buffer.from(await res.arrayBuffer()), width, height, focalX, focalY))
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Cover-crop to width × height, keeping (fx, fy) in frame. sharp has no focal crop: resize, then extract. */
export async function coverCrop(input: Buffer, width: number, height: number, fx = 0.5, fy = 0.5) {
  if (fx === 0.5 && fy === 0.5) return sharp(input).resize(width, height, { fit: "cover" });
  const meta = await sharp(input).metadata();
  const w0 = meta.width ?? width;
  const h0 = meta.height ?? height;
  const scale = Math.max(width / w0, height / h0);
  const rw = Math.max(width, Math.round(w0 * scale));
  const rh = Math.max(height, Math.round(h0 * scale));
  const clamp = (v: number, max: number) => Math.min(Math.max(0, Math.round(v)), max);
  const resized = await sharp(input).resize(rw, rh).toBuffer();
  return sharp(resized).extract({
    left: clamp(fx * rw - width / 2, rw - width),
    top: clamp(fy * rh - height / 2, rh - height),
    width,
    height,
  });
}

/** Only the glyphs in `text`, base64 (cache-serializable). Null → Satori's fallback font. */
export async function ogFont(family: string, text: string): Promise<string | null> {
  "use cache";
  cacheLife("max");
  const data = await loadGoogleFont(family, text);
  return data ? Buffer.from(data).toString("base64") : null;
}

/**
 * Admin preview: the same Google subset, fetched per render and never cached, so typing a headline
 * doesn't leave a cache entry per keystroke (#33). (Satori can't read the committed woff2 files.)
 */
export async function ogFontUncached(family: string, text: string): Promise<string | null> {
  const data = await loadGoogleFont(family, text);
  return data ? Buffer.from(data).toString("base64") : null;
}

export type FontSpec = { name: string; data: string | null; style?: "normal" | "italic"; weight?: 400 };

/** Render with Satori, then re-encode to an optimised JPEG (same settings for cards and previews). */
export async function ogJpegBytes(element: ReactElement, fonts: FontSpec[]): Promise<Buffer> {
  const png = await new ImageResponse(element, {
    ...OG_SIZE,
    fonts: fonts
      .filter((f): f is FontSpec & { data: string } => !!f.data)
      .map((f) => {
        const buf = Buffer.from(f.data, "base64");
        return {
          name: f.name,
          data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
          style: f.style ?? "normal",
          weight: f.weight ?? 400,
        };
      }),
  }).arrayBuffer();
  return sharp(Buffer.from(png)).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

/** A public, CDN-cacheable card response (URLs are versioned with ?v=, so a long cache is safe). */
export async function ogJpeg(element: ReactElement, fonts: FontSpec[]): Promise<Response> {
  const jpeg = await ogJpegBytes(element, fonts);
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": OG_CONTENT_TYPE,
      "Cache-Control": "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400",
    },
  });
}

export { accentParts } from "./share";
