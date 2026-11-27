import { z } from "zod";

/**
 * Every page is an ordered list of sections. Each section type has ONE zod schema here.
 * The same schema drives: DB validation on save, the admin form fields, and the public renderer's props.
 * Add a type → add schema here → add component in registry.tsx → it appears in the editor's "Add section" menu.
 */

export const mediaRef = z.object({
  src: z.string(), // asset URL
  alt: z.string().default(""),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  blurDataUrl: z.string().optional(),
});

/** A hover loop: a short MP4/WebM URL plus its size (portrait loops fill tall tiles). */
export const loopRef = z.object({
  src: z.string(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
});

const link = z.object({ label: z.string(), href: z.string() });

export const heroSchema = z.object({
  eyebrow: z.string().default("Film Editor · Visual Storyteller"),
  /** Words wrapped in *asterisks* render in red italic serif */
  headline: z.string().default("Crafting visual stories *through edit.*"),
  cta: link.default({ label: "View selected work", href: "#work" }),
  media: mediaRef,
});

export const clientMarqueeSchema = z.object({
  label: z.string().default("Trusted by"),
  /** Seconds for one full loop — lower is faster */
  speed: z.number().min(10).max(120).default(45),
  clients: z.array(z.object({ name: z.string(), logo: mediaRef.optional() })).default([]),
});

/** A label as shown on cards and chips (#28). */
export const labelRef = z.object({ name: z.string(), slug: z.string() });

/** URL-safe slug ("Music Video" → "music-video"). Shared by labels, projects and the legacy upgrade. */
export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

export const workGridSchema = z.object({
  label: z.string().default("Selected work"),
  /** Which label chips to show: "auto" = every visible label that has work, in the admin order; or slugs */
  labels: z.union([z.literal("auto"), z.array(z.string())]).default("auto"),
  /** Show at most this many films (home teaser); an "All work →" link appears when there are more */
  limit: z.number().int().min(1).max(60).optional(),
  projects: z
    .array(
      z.object({
        slug: z.string(),
        title: z.string(),
        format: z.string(),
        year: z.number().int(),
        /** In order; the first is the primary label (card tag, breadcrumb) */
        labels: z.array(labelRef).default([]),
        cover: mediaRef,
        /** Short muted hover loop on Vercel Blob (#26) */
        loop: loopRef.optional(),
        /** The film's shape (#24): portrait reels get tall bento tiles */
        orientation: z.enum(["landscape", "portrait", "square"]).default("landscape"),
        /** Admin tile override (#29) */
        cardSize: z.enum(["auto", "feature", "wide", "tall", "square"]).default("auto"),
        featured: z.boolean().default(false),
      }),
    )
    .default([]),
  /** Filled from the Label table when the page renders (chip rail with counts); not edited */
  labelList: z.array(labelRef.extend({ count: z.number().int() })).default([]),
  /** "filter" (/work: chips filter in place and sync ?label=) or "links" (chips go to label pages) */
  chips: z.enum(["filter", "links"]).default("links"),
  tone: z.enum(["ink", "paper"]).default("ink"),
});

const LEGACY_DEFAULT_CHIPS = ["All", "Commercial", "Fashion", "Film", "Documentary"];

/**
 * Stored section data from before a schema change, upgraded on read (#28): the work grid's free-text
 * `categories` chips become label slugs ("auto" when they were the old default), and each project's
 * single `category` becomes its only label. Returns the input untouched for everything else.
 */
export function upgradeSectionData(type: string, data: unknown): unknown {
  if (type !== "workGrid" || !data || typeof data !== "object") return data;
  const d = { ...(data as Record<string, unknown>) };
  if (Array.isArray(d.categories) && d.labels === undefined) {
    const chips = d.categories.filter((c): c is string => typeof c === "string");
    const isDefault = chips.length === LEGACY_DEFAULT_CHIPS.length && chips.every((c, i) => c === LEGACY_DEFAULT_CHIPS[i]);
    d.labels = isDefault ? "auto" : chips.slice(1).map(slugify).filter(Boolean);
  }
  delete d.categories;
  if (Array.isArray(d.projects)) {
    d.projects = d.projects.map((p) => {
      if (!p || typeof p !== "object") return p;
      const { category, ...rest } = p as Record<string, unknown>;
      if (rest.labels !== undefined || typeof category !== "string") return rest;
      return { ...rest, labels: [{ name: category, slug: slugify(category) }] };
    });
  }
  return d;
}

export const statementSchema = z.object({
  /** *italic red serif*, **SANS CAPS**, plain = serif */
  text: z.string(),
});

export const aboutSchema = z.object({
  media: mediaRef,
  heading: z.string(),
  body: z.string(),
  capabilities: z.array(z.string()),
  cta: link,
  tone: z.enum(["ink", "paper"]).default("paper"),
});

export const contactCtaSchema = z.object({
  label: z.string().default("Let's talk"),
  headline: z.string().default("Have a project *in mind?*"),
  email: z.email(),
  note: z.string().optional(),
});

/** Top of inner pages (About / Work / Contact): eyebrow, big serif title, intro. */
export const pageHeaderSchema = z.object({
  eyebrow: z.string().default("About"),
  title: z.string().default("Your next story *starts in the edit.*"),
  intro: z.string().default(""),
});

/** Portrait + key numbers + bio paragraphs (About page). Paragraphs are separated by blank lines. */
export const bioSchema = z.object({
  media: mediaRef,
  stats: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
  body: z.string().default(""),
});

/** "What I do" service cards. */
export const servicesSchema = z.object({
  eyebrow: z.string().default("What I do"),
  title: z.string().default("Beyond *the timeline*"),
  items: z.array(z.object({ title: z.string(), description: z.string(), tag: z.string().default("") })).default([]),
});

/** Grouped client names (Brands / Agencies / Production companies). One name per line in the editor. */
export const clientListSchema = z.object({
  eyebrow: z.string().default("Trusted by"),
  title: z.string().default("*Clients*"),
  groups: z.array(z.object({ label: z.string(), names: z.array(z.string()).default([]) })).default([]),
});

/**
 * Question-shaped subheads with short, factual answers (40–60 words). Rendered fully visible and
 * emitted as FAQPage JSON-LD — the format AI answer engines quote most readily (GEO).
 */
export const faqSchema = z.object({
  eyebrow: z.string().default("Questions"),
  title: z.string().default("Working *together*"),
  items: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).default([]),
});

/** Contact page: enquiry form + contact details sidebar. Email/WhatsApp/socials come from Site settings. */
export const contactFormSchema = z.object({
  projectTypes: z
    .array(z.string())
    .default(["Commercial", "Brand Film", "Fashion Film", "Music Video", "Documentary", "Other"]),
  submitLabel: z.string().default("Send message"),
  successMessage: z.string().default("Thank you — I'll get back to you within 24 hours."),
  location: z.string().default(""),
  availability: z.string().default("Currently available for selected projects worldwide."),
  bookingUrl: z.string().default(""),
  /** "Not sure I'm the right fit? Ask ChatGPT" card */
  askAi: z.boolean().default(true),
});

export const sectionSchemas = {
  hero: heroSchema,
  clientMarquee: clientMarqueeSchema,
  workGrid: workGridSchema,
  statement: statementSchema,
  about: aboutSchema,
  contactCta: contactCtaSchema,
  pageHeader: pageHeaderSchema,
  bio: bioSchema,
  services: servicesSchema,
  clientList: clientListSchema,
  contactForm: contactFormSchema,
  faq: faqSchema,
} as const;

export type SectionType = keyof typeof sectionSchemas;
export type SectionProps<T extends SectionType> = z.infer<(typeof sectionSchemas)[T]>;

export type SectionData = {
  [K in SectionType]: { id: string; type: K; visible: boolean; data: SectionProps<K> };
}[SectionType];
