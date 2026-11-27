import { z } from "zod";

/**
 * Share cards (Open Graph / X images) and search & social defaults (#33). Pure and client-safe: the
 * admin preview and the server resolve cards with the same code, so what the owner sees in Settings is
 * what WhatsApp, LinkedIn and X get.
 *
 * Precedence for a page's card: the page's own override → Settings → the home hero → built-in fallback.
 * Projects default to their cover and title; reels default to the split "portrait" template.
 */

export const SHARE_TEMPLATES = ["still", "type", "portrait"] as const;
export type ShareTemplate = (typeof SHARE_TEMPLATES)[number];

export const FALLBACK_HEADLINE = "Crafting visual stories *through edit.*";
export const FALLBACK_BACKGROUND = "/media/hero.webp";
/** WhatsApp ignores preview images above ~300 KB. */
export const WHATSAPP_MAX_BYTES = 300 * 1024;

const shareImage = z.object({
  id: z.string().max(64).optional(),
  src: z.string().min(1).max(2048),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type ShareImage = z.infer<typeof shareImage>;

const text = (max: number) => z.string().trim().max(max).default("");
const unit = z.number().min(0).max(1);

/** Settings → Sharing & SEO. Every field is optional in storage; defaults reproduce today's card. */
export const siteShareSchema = z.object({
  template: z.enum(SHARE_TEMPLATES).default("still"),
  /** Empty = the home hero's still */
  image: shareImage.nullish(),
  focalX: unit.default(0.5),
  focalY: unit.default(0.5),
  /** 0–100 strength of the left-to-right ink gradient. Null = the template's default */
  overlay: z.number().int().min(0).max(100).nullish(),
  /** *italic red* markup like the CMS. Empty = the home hero headline */
  headline: text(120),
  /** Empty = role · location */
  meta: text(80),
  showMonogram: z.boolean().default(true),
  showWordmark: z.boolean().default(true),
  alt: text(200),
  /** "%s" is the page title, "{name}" the site name */
  titleTemplate: z
    .string()
    .trim()
    .max(60)
    .default("%s — {name}")
    .refine((v) => v.includes("%s"), "Keep %s where the page title goes"),
  /** Default meta description. Empty = the short bio */
  defaultDescription: text(300),
  /** X / Twitter handle for twitter:site and twitter:creator */
  twitterHandle: z
    .string()
    .trim()
    .max(16)
    .default("")
    .refine((v) => !v || /^@?[A-Za-z0-9_]{1,15}$/.test(v), "Letters, numbers and _ only, e.g. @ashyanzafar"),
});
export type SiteShare = z.infer<typeof siteShareSchema>;
export type SiteShareInput = z.input<typeof siteShareSchema>;

/** A page's or project's own card (all optional; empty falls through to Settings / defaults). */
export const pageShareSchema = z.object({
  template: z.enum(SHARE_TEMPLATES).nullish(),
  image: shareImage.nullish(),
  focalX: unit.nullish(),
  focalY: unit.nullish(),
  headline: text(120),
  meta: text(80),
});
export type PageShare = z.infer<typeof pageShareSchema>;
export type PageShareInput = z.input<typeof pageShareSchema>;

export const defaultSiteShare: SiteShare = siteShareSchema.parse({});
export const defaultPageShare: PageShare = pageShareSchema.parse({});

/** Stored JSON → settings, never throwing (bad data falls back to defaults). */
export function parseSiteShare(raw: unknown): SiteShare {
  const r = siteShareSchema.safeParse(raw ?? {});
  return r.success ? r.data : defaultSiteShare;
}
export function parsePageShare(raw: unknown): PageShare {
  const r = pageShareSchema.safeParse(raw ?? {});
  return r.success ? r.data : defaultPageShare;
}

/** Everything the renderer needs: plain values only (cacheable, hashable). */
export type ShareCardInput = {
  template: ShareTemplate;
  /** Layout constants: the site card or the per-film card (they differ slightly, as today) */
  variant: "site" | "project";
  background: string | null;
  focal: { x: number; y: number };
  overlay: number;
  headline: string;
  meta: string;
  monogram: boolean;
  wordmark: boolean;
  siteName: string;
};

export type ShareSite = { name: string; role: string; location?: string | null };
export type ShareHero = { headline?: string; src?: string };

export const OVERLAY_DEFAULT = { site: 72, project: 55 } as const;
const join = (parts: (string | number | null | undefined)[]) => parts.filter(Boolean).join("  ·  ");

/** A CMS page (home, work, about, contact) or a label page. */
export function pageShareCard(args: {
  site: ShareSite;
  settings: SiteShare;
  hero?: ShareHero;
  override?: PageShare;
  /** Label pages: "<Label> *work.*" unless Settings/override set a headline */
  labelName?: string;
}): ShareCardInput {
  const { site, settings, hero, override, labelName } = args;
  const o = override ?? defaultPageShare;
  return {
    template: o.template ?? settings.template,
    variant: "site",
    background: o.image?.src || settings.image?.src || hero?.src || FALLBACK_BACKGROUND,
    focal: { x: o.focalX ?? settings.focalX, y: o.focalY ?? settings.focalY },
    overlay: settings.overlay ?? OVERLAY_DEFAULT.site,
    headline: o.headline || (labelName ? `${labelName} *work.*` : "") || settings.headline || hero?.headline || FALLBACK_HEADLINE,
    meta: (o.meta || settings.meta || join([site.role, site.location])).toUpperCase(),
    monogram: settings.showMonogram,
    wordmark: settings.showWordmark,
    siteName: site.name,
  };
}

/** A film's card: its cover and title, the split template for reels. */
export function projectShareCard(args: {
  site: ShareSite;
  settings: SiteShare;
  override?: PageShare;
  project: {
    title: string;
    cover: string;
    format?: string;
    clientName?: string;
    year?: number;
    orientation?: "landscape" | "portrait" | "square";
    labelName?: string;
  };
}): ShareCardInput {
  const { site, settings, override, project: p } = args;
  const o = override ?? defaultPageShare;
  const reel = p.orientation === "portrait" || p.orientation === "square";
  const template = o.template ?? (reel ? "portrait" : "still");
  return {
    template,
    variant: "project",
    background: o.image?.src || p.cover,
    focal: { x: o.focalX ?? 0.5, y: o.focalY ?? 0.5 },
    overlay: settings.overlay ?? OVERLAY_DEFAULT.project,
    headline: o.headline || p.title,
    meta: (o.meta || (template === "portrait" ? join(["Reel", p.labelName, p.year]) : join([p.format, p.clientName, p.year]))).toUpperCase(),
    monogram: settings.showMonogram,
    wordmark: settings.showWordmark,
    siteName: site.name,
  };
}

/** Stable short hash of a card (FNV-1a), the ?v= that makes chat apps fetch a changed card again. */
export function shareVersion(input: ShareCardInput): string {
  const json = stableJson(input);
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** JSON with object keys sorted at every level (a key-array replacer would drop nested keys). */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** "%s — {name}" → "%s — Ashyan Zafar" (Next's title.template) */
export const titleTemplateFor = (settings: SiteShare, siteName: string) =>
  settings.titleTemplate.replaceAll("{name}", siteName);

/** "*Crafting* visual" → [["Crafting", true], [" visual", false]]. **CAPS** has no special look. */
export function accentParts(text: string): [string, boolean][] {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith("*") && part.endsWith("*") ? [part.slice(1, -1), true] : [part, false]));
}

/** Roughly how many lines a headline takes on the card (Instrument Serif, greedy word wrap). */
export function estimateLines(text: string, maxWidth = 820, fontSize = 92): number {
  const plain = accentParts(text)
    .map(([t]) => t)
    .join("");
  // Instrument Serif averages ~0.36em per character
  const perLine = Math.max(1, Math.floor(maxWidth / (fontSize * 0.36)));
  let lines = 1;
  let used = 0;
  for (const word of plain.split(/\s+/).filter(Boolean)) {
    const len = word.length + (used ? 1 : 0);
    if (used + len > perLine && used) {
      lines++;
      used = word.length;
    } else used += len;
  }
  return lines;
}

export type ShareCheck = { field: string; message: string };

/** Advice shown beside the fields: warnings, never blocking. */
export function shareChecks(args: {
  card: ShareCardInput;
  settings: SiteShare;
  title: string;
  description: string;
  imageSize?: { width?: number; height?: number };
  bytes?: number;
}): ShareCheck[] {
  const { card, settings, title, description, imageSize, bytes } = args;
  const out: ShareCheck[] = [];
  const plain = accentParts(card.headline)
    .map(([t]) => t)
    .join("");
  if (plain.length > 60) out.push({ field: "headline", message: `Headline is ${plain.length} characters; over ~60 it gets cut in some apps.` });
  if (card.template !== "portrait" && estimateLines(card.headline) > 3)
    out.push({ field: "headline", message: "Headline wraps to 4+ lines, so it may be cut on X." });
  if (imageSize?.width && imageSize.height) {
    if (imageSize.width < 1200 || imageSize.height < 630)
      out.push({ field: "image", message: `Background is ${imageSize.width}×${imageSize.height}; use at least 1200×630 for a sharp card.` });
    if (imageSize.height > imageSize.width && card.focal.x === 0.5 && card.focal.y === 0.5 && card.template === "still")
      out.push({ field: "focal", message: "Portrait background: set a focal point so faces aren't cut off." });
  }
  if (bytes !== undefined && bytes > WHATSAPP_MAX_BYTES)
    out.push({ field: "card", message: `Card is ${Math.round(bytes / 1024)} KB; WhatsApp skips previews over 300 KB.` });
  if (description.length > 160) out.push({ field: "description", message: `Description is ${description.length} characters; Google shows about 160.` });
  if (description.length > 0 && description.length < 50)
    out.push({ field: "description", message: `Description is only ${description.length} characters; aim for 50–160.` });
  if (title.length > 60) out.push({ field: "title", message: `Title is ${title.length} characters with the template; Google cuts at about 60.` });
  if (!settings.alt) out.push({ field: "alt", message: "Add alt text so screen readers can describe the card." });
  return out;
}
