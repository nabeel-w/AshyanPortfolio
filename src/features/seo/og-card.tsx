import "server-only";
import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import sharp from "sharp";
import { absoluteUrl } from "@/lib/site-url";
import { loadGoogleFont } from "./og-font";

/**
 * Shared plumbing for Open Graph cards (site card + project cards):
 *  - inputs (background still, font subsets, monogram) are fetched once and cached ("use cache"),
 *    so a crawler gets the card in milliseconds instead of re-fetching everything per request;
 *  - output is a ~100 KB JPEG, not a ~700 KB PNG. WhatsApp ignores preview images over ~300 KB,
 *    and every chat app loads it faster.
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

/** Remote or site-relative image → cover-cropped 1200×630 JPEG data URL (Satori can't decode WebP/AVIF). */
export async function ogBackground(
  src: string,
  width = OG_SIZE.width,
  height = OG_SIZE.height,
): Promise<string | null> {
  "use cache";
  cacheLife("max");
  const url = src.startsWith("http") ? src : absoluteUrl(src);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(width, height, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Only the glyphs in `text`, base64 (cache-serializable). Null → Satori's fallback font. */
export async function ogFont(family: string, text: string): Promise<string | null> {
  "use cache";
  cacheLife("max");
  const data = await loadGoogleFont(family, text);
  return data ? Buffer.from(data).toString("base64") : null;
}

type FontSpec = { name: string; data: string | null; style?: "normal" | "italic"; weight?: 400 };

/** Render with Satori, then re-encode to an optimised JPEG. */
export async function ogJpeg(element: ReactElement, fonts: FontSpec[]): Promise<Response> {
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
  const jpeg = await sharp(Buffer.from(png)).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": OG_CONTENT_TYPE,
      "Cache-Control": "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400",
    },
  });
}

/** "Crafting visual stories *through edit.*" → [["Crafting visual stories ", false], ["through edit.", true]] */
export function accentParts(text: string): [string, boolean][] {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **SANS CAPS** has no special look on the card
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("*") && part.endsWith("*") ? [part.slice(1, -1), true] : [part, false],
    );
}
