import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getProject } from "@/features/content/projects";
import { loadGoogleFont } from "@/features/seo/og-font";
import { absoluteUrl } from "@/lib/site-url";

export const alt = "Film by Ashyan Zafar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Satori can't decode WebP/AVIF, so the cover is re-encoded to a 1200px JPEG data URL. */
async function coverDataUrl(src: string) {
  const url = src.startsWith("http") ? src : absoluteUrl(src);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize(1200, 630, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProject(slug);
  const title = p?.title ?? "Ashyan Zafar";
  const meta = p ? `${p.format} · ${p.year}` : "Film Editor";
  const [cover, serif] = await Promise.all([
    p ? coverDataUrl(p.cover.src) : null,
    loadGoogleFont("Instrument Serif", title),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#0a0a0a" }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, objectFit: "cover" }} />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.55) 55%, rgba(10,10,10,0.1) 100%)",
          }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#f4f1ec", fontSize: 20, letterSpacing: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 10, background: "#c1121f" }} />
            ASHYAN ZAFAR
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ width: 72, height: 2, background: "#c1121f" }} />
            <div
              style={{
                fontFamily: serif ? "Instrument Serif" : "serif",
                fontSize: title.length > 22 ? 84 : 104,
                lineHeight: 0.95,
                color: "#f4f1ec",
                letterSpacing: -2,
                maxWidth: 900,
              }}
            >
              {title}
            </div>
            <div style={{ color: "#8c8984", fontSize: 22, letterSpacing: 6 }}>{meta.toUpperCase()}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: serif ? [{ name: "Instrument Serif", data: serif, style: "normal", weight: 400 }] : [] },
  );
}
