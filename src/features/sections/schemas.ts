import { z } from "zod";

/**
 * Every page is an ordered list of sections. Each section type has ONE zod schema here.
 * The same schema drives: DB validation on save, the admin form fields, and the public renderer's props.
 * Add a type → add schema here → add component in registry.tsx → it appears in the editor's "Add section" menu.
 */

export const mediaRef = z.object({
  src: z.string(), // asset URL (image) or playback id (video)
  alt: z.string().default(""),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  blurDataUrl: z.string().optional(),
});

const link = z.object({ label: z.string(), href: z.string() });

export const heroSchema = z.object({
  eyebrow: z.string().default("Film Editor · Visual Storyteller"),
  /** Words wrapped in *asterisks* render in red italic serif */
  headline: z.string().default("Crafting visual stories *through edit.*"),
  cta: link.default({ label: "View selected work", href: "#work" }),
  media: mediaRef,
  /** Optional muted background loop (Mux playback id) */
  videoPlaybackId: z.string().optional(),
});

export const clientMarqueeSchema = z.object({
  label: z.string().default("Trusted by"),
  /** Seconds for one full loop — lower is faster */
  speed: z.number().min(10).max(120).default(45),
  clients: z.array(z.object({ name: z.string(), logo: mediaRef.optional() })).default([]),
});

export const workGridSchema = z.object({
  label: z.string().default("Selected work"),
  categories: z.array(z.string()).default(["All", "Commercial", "Fashion", "Film", "Documentary"]),
  projects: z
    .array(
      z.object({
        slug: z.string(),
        title: z.string(),
        format: z.string(),
        year: z.number().int(),
        category: z.string(),
        cover: mediaRef,
        loopPlaybackId: z.string().optional(),
      }),
    )
    .default([]),
  tone: z.enum(["ink", "paper"]).default("ink"),
});

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
} as const;

export type SectionType = keyof typeof sectionSchemas;
export type SectionProps<T extends SectionType> = z.infer<(typeof sectionSchemas)[T]>;

export type SectionData = {
  [K in SectionType]: { id: string; type: K; visible: boolean; data: SectionProps<K> };
}[SectionType];
