import { getProject } from "@/features/content/projects";
import { projectOgTemplate } from "@/features/content/neighbours";
import { getSite } from "@/features/content/queries";
import {
  OG_COLORS as C,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogBackground,
  ogFont,
  ogJpeg,
} from "@/features/seo/og-card";

/** Per-film share card: the cover still, the title in Instrument Serif, format · year. JPEG, inputs cached. */
export const alt = "Film by Ashyan Zafar";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, site] = await Promise.all([getProject(slug), getSite()]);
  const title = p?.title ?? site.name;
  const meta = p ? [p.format, p.clientName, p.year].filter(Boolean).join("  ·  ") : site.role;
  const portrait = p ? projectOgTemplate(p) === "portrait" : false;
  const [cover, monogram, serif] = await Promise.all([
    p ? (portrait ? ogBackground(p.cover.src, 354, 630) : ogBackground(p.cover.src)) : null,
    ogBackground("/apple-icon.png", 180, 180),
    ogFont("Instrument Serif", title),
  ]);
  const words = site.name.toUpperCase().split(" ");

  if (portrait && p) {
    // Reels (#30): the 9:16 frame uncropped on the left, an ink title panel on the right.
    const reelMeta = ["Reel", p.labels.find((l) => l.visible)?.name, p.year].filter(Boolean).join("  ·  ").toUpperCase();
    return ogJpeg(
      <div style={{ width: "100%", height: "100%", display: "flex", background: C.ink }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori renders <img>
          <img src={cover} alt="" width={354} height={630} style={{ width: 354, height: 630, objectFit: "cover" }} />
        ) : (
          <div style={{ width: 354, height: 630, background: "#1c1c1c" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 64px", flex: 1, borderLeft: "1px solid #262626" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {monogram ? (
              // eslint-disable-next-line @next/next/no-img-element -- Satori renders <img>
              <img src={monogram} alt="" width={48} height={48} style={{ border: "1px solid #262626" }} />
            ) : null}
            <div style={{ display: "flex", alignItems: "center", color: C.ivory, fontSize: 18, letterSpacing: 8 }}>
              {words[0]}
              <span style={{ color: C.red, margin: "0 10px" }}>·</span>
              {words.slice(1).join(" ")}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: C.smoke, fontSize: 18, letterSpacing: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: C.red }} />
              REC
            </div>
            <div style={{ fontFamily: serif ? "Instrument Serif" : "serif", fontSize: title.length > 18 ? 76 : 96, lineHeight: 0.95, color: C.ivory, letterSpacing: -2 }}>
              {title}
            </div>
            <div style={{ display: "flex", color: C.smoke, fontSize: 20, letterSpacing: 6 }}>{reelMeta}</div>
          </div>
        </div>
      </div>,
      [{ name: "Instrument Serif", data: serif }],
    );
  }

  return ogJpeg(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: C.ink,
      }}
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori renders <img>
        <img
          src={cover}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, objectFit: "cover" }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.55) 55%, rgba(10,10,10,0.1) 100%)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {monogram ? (
            // eslint-disable-next-line @next/next/no-img-element -- Satori renders <img>
            <img
              src={monogram}
              alt=""
              width={56}
              height={56}
              style={{ border: "1px solid #262626" }}
            />
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: C.ivory,
              fontSize: 20,
              letterSpacing: 9,
            }}
          >
            {words[0]}
            <span style={{ color: C.red, margin: "0 12px" }}>·</span>
            {words.slice(1).join(" ")}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ width: 72, height: 2, background: C.red }} />
          <div
            style={{
              fontFamily: serif ? "Instrument Serif" : "serif",
              fontSize: title.length > 22 ? 84 : 104,
              lineHeight: 0.95,
              color: C.ivory,
              letterSpacing: -2,
              maxWidth: 900,
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", color: C.smoke, fontSize: 22, letterSpacing: 6 }}>
            {meta.toUpperCase()}
          </div>
        </div>
      </div>
    </div>,
    [{ name: "Instrument Serif", data: serif }],
  );
}
