import "server-only";
import {
  OG_COLORS as C,
  ogBackground,
  ogFont,
  ogFontUncached,
  ogJpegBytes,
  type FontSpec,
} from "./og-card";
import { accentParts, type ShareCardInput } from "./share";

/**
 * The one share-card renderer (#33). Every card on the site (home/work/about/contact, label pages,
 * projects) and the admin preview call this with a resolved ShareCardInput, so the preview is the
 * real card. Templates:
 *   still     background still + ink gradient + headline (the site card / the per-film card)
 *   type      ink only, the headline set large
 *   portrait  the 9:16 still on the left, an ink title panel on the right (reels)
 * With nothing customised the output matches the cards from before #33.
 */
export async function renderShareCard(input: ShareCardInput, opts: { preview?: boolean } = {}): Promise<Buffer> {
  const font = opts.preview ? ogFontUncached : ogFont;
  const parts = accentParts(input.headline || " ");
  const plain = parts.filter(([, a]) => !a).map(([t]) => t).join("");
  const accent = parts.filter(([, a]) => a).map(([t]) => t).join("");
  const portrait = input.template === "portrait";

  const [background, monogram, serif, serifItalic] = await Promise.all([
    input.template === "type" || !input.background
      ? null
      : portrait
        ? ogBackground(input.background, 354, 630, input.focal.x, input.focal.y)
        : ogBackground(input.background, 1200, 630, input.focal.x, input.focal.y),
    input.monogram ? ogBackground("/apple-icon.png", 180, 180) : null,
    font("Instrument Serif", plain || " "),
    accent ? font("Instrument Serif:ital@1", accent) : null,
  ]);
  const fonts: FontSpec[] = [
    { name: "Instrument Serif", data: serif },
    { name: "Instrument Serif Italic", data: serifItalic, style: "italic" },
  ];
  const words = input.siteName.toUpperCase().split(" ");
  const serifFamily = serif ? "Instrument Serif" : "serif";
  const italicFamily = serifItalic ? "Instrument Serif Italic" : "serif";
  const site = input.variant === "site";

  const brand = (size: { mark: number; text: number; spacing: number; gap: number }) =>
    input.monogram || input.wordmark ? (
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {monogram ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori renders <img>
          <img src={monogram} alt="" width={size.mark} height={size.mark} style={{ border: "1px solid #262626" }} />
        ) : null}
        {input.wordmark ? (
          <div style={{ display: "flex", alignItems: "center", color: C.ivory, fontSize: size.text, letterSpacing: size.spacing }}>
            {words[0]}
            <span style={{ color: C.red, margin: `0 ${size.gap}px` }}>·</span>
            {words.slice(1).join(" ")}
          </div>
        ) : null}
      </div>
    ) : (
      <div style={{ display: "flex" }} />
    );

  const headline = (style: { fontSize: number; lineHeight: number; maxWidth: number }) =>
    accent ? (
      <div style={{ display: "flex", flexWrap: "wrap", maxWidth: style.maxWidth, fontSize: style.fontSize, lineHeight: style.lineHeight, letterSpacing: -2, color: C.ivory }}>
        {parts.map(([text, isAccent], i) => (
          <span
            key={i}
            style={{
              fontFamily: isAccent ? italicFamily : serifFamily,
              color: isAccent ? C.signal : C.ivory,
              fontStyle: isAccent ? "italic" : "normal",
              whiteSpace: "pre-wrap",
            }}
          >
            {text}
          </span>
        ))}
      </div>
    ) : (
      <div style={{ fontFamily: serifFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, color: C.ivory, letterSpacing: -2, maxWidth: style.maxWidth }}>
        {plain}
      </div>
    );

  if (portrait) {
    return ogJpegBytes(
      <div style={{ width: "100%", height: "100%", display: "flex", background: C.ink }}>
        {background ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori renders <img>
          <img src={background} alt="" width={354} height={630} style={{ width: 354, height: 630, objectFit: "cover" }} />
        ) : (
          <div style={{ width: 354, height: 630, background: "#1c1c1c" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 64px", flex: 1, borderLeft: "1px solid #262626" }}>
          {brand({ mark: 48, text: 18, spacing: 8, gap: 10 })}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: C.smoke, fontSize: 18, letterSpacing: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6, background: C.red }} />
              REC
            </div>
            {headline({ fontSize: plain.length + accent.length > 18 ? 76 : 96, lineHeight: 0.95, maxWidth: 700 })}
            <div style={{ display: "flex", color: C.smoke, fontSize: 20, letterSpacing: 6 }}>{input.meta}</div>
          </div>
        </div>
      </div>,
      fonts,
    );
  }

  // Overlay 0–100 → the left-to-right ink gradient. The defaults (72 site / 55 film) are the old cards'.
  const o = input.overlay / 100;
  const gradient = site
    ? `linear-gradient(90deg, rgba(10,10,10,${round(Math.min(1, o + 0.22))}) 0%, rgba(10,10,10,${round(o)}) 48%, rgba(10,10,10,${round(Math.max(0, o - 0.57))}) 100%)`
    : `linear-gradient(90deg, rgba(10,10,10,${round(Math.min(1, o + 0.37))}) 0%, rgba(10,10,10,${round(o)}) 55%, rgba(10,10,10,${round(Math.max(0, o - 0.45))}) 100%)`;
  const titleLength = plain.length + accent.length;

  return ogJpegBytes(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: C.ink }}>
      {background ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori renders <img>
        <img src={background} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, objectFit: "cover" }} />
      ) : null}
      {input.template === "still" ? <div style={{ position: "absolute", inset: 0, background: gradient }} /> : null}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, width: "100%" }}>
        {site ? brand({ mark: 64, text: 22, spacing: 10, gap: 14 }) : brand({ mark: 56, text: 20, spacing: 9, gap: 12 })}
        <div style={{ display: "flex", flexDirection: "column", gap: site ? 26 : 20 }}>
          <div style={{ width: 72, height: 2, background: C.red }} />
          {site || input.template === "type"
            ? headline({ fontSize: input.template === "type" ? (titleLength > 40 ? 92 : 112) : 92, lineHeight: 1.02, maxWidth: input.template === "type" ? 1000 : 820 })
            : headline({ fontSize: titleLength > 22 ? 84 : 104, lineHeight: 0.95, maxWidth: 900 })}
          <div style={{ display: "flex", color: C.smoke, fontSize: 22, letterSpacing: site ? 7 : 6 }}>{input.meta}</div>
        </div>
      </div>
    </div>,
    fonts,
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
