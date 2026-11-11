import type { SectionType } from "@/features/sections/schemas";

/**
 * Declarative form fields. The generic <SchemaForm> renders these; zod schemas stay the source of
 * truth for validation. Adding a section type = schema + component + registry + an entry here.
 */
type Base = { name: string; label: string; help?: string };

export type FieldDef =
  | (Base & { type: "text" | "email" | "url"; placeholder?: string })
  | (Base & { type: "textarea"; rows?: number; placeholder?: string })
  /** Textarea with the *italic red* / **CAPS** markup hint */
  | (Base & { type: "richtext"; rows?: number })
  | (Base & { type: "number"; min?: number; max?: number; step?: number })
  | (Base & { type: "select"; options: { value: string; label: string }[] })
  | (Base & { type: "switch" })
  /** Image from the media library, stored as a mediaRef { src, alt, width, height, blurDataUrl } */
  | (Base & { type: "image" })
  /** string[] edited one item per line */
  | (Base & { type: "lines"; rows?: number; placeholder?: string })
  /** Array of objects */
  | (Base & { type: "list"; item: FieldDef[]; itemTitle?: string; addLabel?: string; newItem: Record<string, unknown> })
  /** Nested object */
  | (Base & { type: "group"; fields: FieldDef[] })
  /** Read-only hint shown inside the form */
  | { type: "note"; name: string; text: string };

const cta: FieldDef = {
  type: "group",
  name: "cta",
  label: "Button",
  fields: [
    { type: "text", name: "label", label: "Label" },
    { type: "text", name: "href", label: "Link", help: "e.g. /work, /contact or #work" },
  ],
};

const tone: FieldDef = {
  type: "select",
  name: "tone",
  label: "Background",
  options: [
    { value: "ink", label: "Black" },
    { value: "paper", label: "White paper" },
  ],
};

export const sectionFields: Record<SectionType, FieldDef[]> = {
  hero: [
    { type: "text", name: "eyebrow", label: "Eyebrow" },
    { type: "richtext", name: "headline", label: "Headline", rows: 2 },
    cta,
    { type: "image", name: "media", label: "Background image", help: "Use a hi-res landscape still; the subject reads best on the right." },
  ],
  pageHeader: [
    { type: "text", name: "eyebrow", label: "Eyebrow" },
    { type: "richtext", name: "title", label: "Title", rows: 2 },
    { type: "textarea", name: "intro", label: "Intro", rows: 3 },
  ],
  clientMarquee: [
    { type: "text", name: "label", label: "Label" },
    { type: "number", name: "speed", label: "Loop duration (seconds)", min: 10, max: 120, help: "Lower is faster." },
    {
      type: "note",
      name: "clientsNote",
      text: "Logos come from Admin → Clients. The names below are only shown while that list is empty.",
    },
    {
      type: "list",
      name: "clients",
      label: "Fallback names",
      itemTitle: "name",
      addLabel: "Add name",
      newItem: { name: "" },
      item: [{ type: "text", name: "name", label: "Name" }],
    },
  ],
  workGrid: [
    { type: "text", name: "label", label: "Heading", help: "The last word becomes the red italic accent." },
    { type: "lines", name: "categories", label: "Filter chips", help: "One per line. The first one shows everything." },
    tone,
    { type: "note", name: "projectsNote", text: "Films come from Admin → Projects (published, featured first)." },
  ],
  statement: [{ type: "richtext", name: "text", label: "Statement", rows: 4 }],
  about: [
    { type: "richtext", name: "heading", label: "Heading" },
    { type: "textarea", name: "body", label: "Text", rows: 4 },
    { type: "lines", name: "capabilities", label: "Capabilities", help: "One per line." },
    cta,
    { type: "image", name: "media", label: "Image" },
    tone,
  ],
  bio: [
    { type: "image", name: "media", label: "Portrait" },
    {
      type: "list",
      name: "stats",
      label: "Key numbers",
      itemTitle: "label",
      addLabel: "Add number",
      newItem: { value: "", label: "" },
      item: [
        { type: "text", name: "value", label: "Value", placeholder: "150+" },
        { type: "text", name: "label", label: "Label", placeholder: "Projects" },
      ],
    },
    { type: "textarea", name: "body", label: "Biography", rows: 10, help: "Separate paragraphs with a blank line." },
  ],
  services: [
    { type: "text", name: "eyebrow", label: "Eyebrow" },
    { type: "richtext", name: "title", label: "Title" },
    {
      type: "list",
      name: "items",
      label: "Services",
      itemTitle: "title",
      addLabel: "Add service",
      newItem: { title: "", description: "", tag: "" },
      item: [
        { type: "text", name: "title", label: "Title" },
        { type: "textarea", name: "description", label: "Description", rows: 3 },
        { type: "text", name: "tag", label: "Tag", placeholder: "Core" },
      ],
    },
  ],
  clientList: [
    { type: "text", name: "eyebrow", label: "Eyebrow" },
    { type: "richtext", name: "title", label: "Title" },
    {
      type: "list",
      name: "groups",
      label: "Groups",
      itemTitle: "label",
      addLabel: "Add group",
      newItem: { label: "", names: [] },
      item: [
        { type: "text", name: "label", label: "Group", placeholder: "Brands" },
        { type: "lines", name: "names", label: "Names", rows: 6, help: "One per line." },
      ],
    },
  ],
  contactCta: [
    { type: "text", name: "label", label: "Eyebrow" },
    { type: "richtext", name: "headline", label: "Headline", rows: 2 },
    { type: "email", name: "email", label: "Email" },
    { type: "text", name: "note", label: "Small print" },
  ],
  faq: [
    { type: "text", name: "eyebrow", label: "Eyebrow" },
    { type: "richtext", name: "title", label: "Title" },
    {
      type: "note",
      name: "faqNote",
      text: "Write each question the way a client would ask it, and answer in 40–60 plain, factual words. Search engines and AI assistants quote these directly.",
    },
    {
      type: "list",
      name: "items",
      label: "Questions",
      itemTitle: "question",
      addLabel: "Add question",
      newItem: { question: "", answer: "" },
      item: [
        { type: "text", name: "question", label: "Question" },
        { type: "textarea", name: "answer", label: "Answer", rows: 4 },
      ],
    },
  ],
  contactForm: [
    { type: "note", name: "contactNote", text: "Email, WhatsApp and social links come from Admin → Settings." },
    { type: "lines", name: "projectTypes", label: "Project types", help: "Options in the form's dropdown, one per line." },
    { type: "text", name: "submitLabel", label: "Button label" },
    { type: "textarea", name: "successMessage", label: "Thank-you message", rows: 2 },
    { type: "text", name: "location", label: "Location" },
    { type: "textarea", name: "availability", label: "Availability", rows: 2 },
    { type: "url", name: "bookingUrl", label: "Booking link", help: "Optional, e.g. a Cal.com page." },
    { type: "switch", name: "askAi", label: "Show the “Ask ChatGPT about me” card" },
  ],
};

export const settingsFields: FieldDef[] = [
  { type: "text", name: "name", label: "Name" },
  { type: "text", name: "role", label: "Role", placeholder: "Film Editor" },
  { type: "text", name: "location", label: "Location" },
  { type: "email", name: "email", label: "Contact email" },
  { type: "text", name: "whatsapp", label: "WhatsApp number", help: "With country code, e.g. +91 83349 08607. Leave empty to hide the button." },
  { type: "textarea", name: "whatsappMessage", label: "WhatsApp prefilled message", rows: 2 },
  {
    type: "textarea",
    name: "bio",
    label: "Short bio",
    rows: 3,
    help: "One or two factual sentences. Used for search results, AI answers (llms.txt) and structured data.",
  },
  {
    type: "list",
    name: "socials",
    label: "Profiles",
    help: "Use full profile URLs (e.g. https://vimeo.com/ashyanzafar). IMDb, Vimeo, LinkedIn, Instagram and Behance help search engines and AI assistants confirm who you are.",
    itemTitle: "label",
    addLabel: "Add profile",
    newItem: { label: "", href: "https://" },
    item: [
      { type: "text", name: "label", label: "Label", placeholder: "Vimeo" },
      { type: "url", name: "href", label: "URL" },
    ],
  },
];
