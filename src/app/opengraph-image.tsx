import { getPublishedPage, getSite } from "@/features/content/queries";
import {
  accentParts,
  OG_COLORS as C,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogBackground,
  ogFont,
  ogJpeg,
} from "@/features/seo/og-card";

/**
 * The site's share card (home, /work, /about, /contact): the published hero still, the hero headline
 * with its red italic accent, AZ monogram + wordmark. Project pages have their own card.
 * pageMetadata() points every CMS page at it explicitly, because a page that sets `openGraph`
 * replaces the parent's (Next merges metadata shallowly).
 */
export const alt = "Ashyan Zafar, film editor";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const FALLBACK_HEADLINE = "Crafting visual stories *through edit.*";

export default async function Image() {
  const [site, home] = await Promise.all([getSite(), getPublishedPage("home")]);
  const hero = home.find((s) => s.type === "hero")?.data as
    { headline?: string; media?: { src?: string } } | undefined;
  const headline = hero?.headline || FALLBACK_HEADLINE;
  const parts = accentParts(headline);
  const plain = parts
    .filter(([, a]) => !a)
    .map(([t]) => t)
    .join("");
  const accent = parts
    .filter(([, a]) => a)
    .map(([t]) => t)
    .join("");

  const [background, monogram, serif, serifItalic] = await Promise.all([
    ogBackground(hero?.media?.src || "/media/hero.webp"),
    ogBackground("/apple-icon.png", 180, 180),
    ogFont("Instrument Serif", plain || " "),
    ogFont("Instrument Serif:ital@1", accent || " "),
  ]);
  const meta = [site.role, site.location].filter(Boolean).join("  ·  ").toUpperCase();

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
      {background ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori renders <img>
        <img
          src={background}
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
            "linear-gradient(90deg, rgba(10,10,10,0.94) 0%, rgba(10,10,10,0.72) 48%, rgba(10,10,10,0.15) 100%)",
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
              width={64}
              height={64}
              style={{ border: "1px solid #262626" }}
            />
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: C.ivory,
              fontSize: 22,
              letterSpacing: 10,
            }}
          >
            {site.name.toUpperCase().split(" ")[0]}
            <span style={{ color: C.red, margin: "0 14px" }}>·</span>
            {site.name.toUpperCase().split(" ").slice(1).join(" ")}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ width: 72, height: 2, background: C.red }} />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              maxWidth: 820,
              fontSize: 92,
              lineHeight: 1.02,
              letterSpacing: -2,
              color: C.ivory,
            }}
          >
            {parts.map(([text, isAccent], i) => (
              <span
                key={i}
                style={{
                  fontFamily: isAccent
                    ? serifItalic
                      ? "Instrument Serif Italic"
                      : "serif"
                    : serif
                      ? "Instrument Serif"
                      : "serif",
                  color: isAccent ? C.signal : C.ivory,
                  fontStyle: isAccent ? "italic" : "normal",
                  whiteSpace: "pre-wrap",
                }}
              >
                {text}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", color: C.smoke, fontSize: 22, letterSpacing: 7 }}>
            {meta}
          </div>
        </div>
      </div>
    </div>,
    [
      { name: "Instrument Serif", data: serif },
      { name: "Instrument Serif Italic", data: serifItalic, style: "italic" },
    ],
  );
}
