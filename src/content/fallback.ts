import type { SectionData } from "@/features/sections/schemas";

/**
 * Placeholder content shown until the admin publishes real content.
 * Images in public/media were generated in ChatGPT as on-brand stand-ins — replace with real stills before launch.
 */

export const site = {
  name: "Ashyan Zafar",
  role: "Film Editor",
  location: "India · Working worldwide",
  email: "hello@ashyanzafar.com",
  copyrightYear: 2026,
  whatsapp: "+91 83349 08607" as string | null,
  whatsappMessage: "Hi Ashyan, I saw your portfolio and would love to talk about a project.",
  description:
    "Ashyan Zafar is an independent film editor crafting commercials, fashion films, documentaries and branded content with rhythm, restraint and emotion.",
  socials: [
    { label: "Instagram", href: "https://instagram.com/" },
    { label: "Vimeo", href: "https://vimeo.com/" },
    { label: "LinkedIn", href: "https://linkedin.com/" },
  ],
  nav: [
    { label: "Work", href: "/#work" },
    { label: "About", href: "/#about" },
    { label: "Capabilities", href: "/#about" },
    { label: "Contact", href: "/#contact" },
  ],
};

const img = (name: string, width: number, height: number, alt: string) => ({
  src: `/media/${name}.webp`,
  width,
  height,
  alt,
});

export const homeSections: SectionData[] = [
  {
    id: "hero",
    type: "hero",
    visible: true,
    data: {
      eyebrow: "Film Editor · Visual Storyteller",
      headline: "Crafting visual stories *through edit.*",
      cta: { label: "View selected work", href: "#work" },
      media: img("hero", 1672, 941, "A woman in a dark coat looks skyward beside brutalist concrete, a thin red rim light on her profile"),
    },
  },
  {
    id: "clients",
    type: "clientMarquee",
    visible: true,
    data: {
      label: "Trusted by",
      speed: 45,
      clients: [
        "Netflix",
        "Nike",
        "Vogue",
        "Red Bull",
        "Audi",
        "Sony",
        "Zara",
        "Spotify",
        "Hermès",
        "BBC",
      ].map((name) => ({ name })),
    },
  },
  {
    id: "work",
    type: "workGrid",
    visible: true,
    data: {
      label: "Selected work",
      tone: "ink",
      categories: ["All", "Commercial", "Fashion", "Film", "Documentary"],
      projects: [
        { slug: "the-next-chapter", title: "The Next Chapter", format: "Brand Film", year: 2024, category: "Commercial", cover: img("next-chapter", 1672, 941, "Extreme close-up of an eye under dappled leaf shadows with a red glint") },
        { slug: "drive-further", title: "Drive Further", format: "Commercial", year: 2024, category: "Commercial", cover: img("drive-further", 1672, 941, "Black sports car under a concrete bridge at night, red tail light on wet asphalt") },
        { slug: "resonance", title: "Résonance", format: "Fashion Film", year: 2023, category: "Fashion", cover: img("resonance", 1672, 941, "Model in a flowing red silk dress on a black-sand coastline") },
        { slug: "the-silent-ones", title: "The Silent Ones", format: "Short Film", year: 2023, category: "Film", cover: img("silent-ones", 1672, 941, "Profile silhouette of a man in backlit smoke") },
        { slug: "mumbai-my-city", title: "Mumbai, My City", format: "Documentary", year: 2022, category: "Documentary", cover: img("mumbai", 1672, 941, "Mumbai skyline at blue hour with red aircraft lights on the towers") },
      ],
    },
  },
  {
    id: "statement",
    type: "statement",
    visible: true,
    data: {
      text: "**Every frame** has a reason. *Every cut* has a **feeling.** I shape *rhythm, tension & silence* **into stories that stay.**",
    },
  },
  {
    id: "about",
    type: "about",
    visible: true,
    data: {
      tone: "paper",
      media: img("studio", 1448, 1086, "Ashyan at a dark edit suite, a red playhead on the timeline"),
      heading: "More than *just a cut.*",
      body: "I'm Ashyan Zafar — an independent film editor working across commercials, fashion, film and branded content. I care about pace, performance and the quiet moments between.",
      capabilities: ["Editing", "Colour Grading", "Sound Design", "Motion Graphics", "Finishing"],
      cta: { label: "Learn more", href: "/about" },
    },
  },
  {
    id: "contact",
    type: "contactCta",
    visible: true,
    data: {
      label: "Let's talk",
      headline: "Have a project *in mind?*",
      email: "hello@ashyanzafar.com",
      note: "Currently booking projects for 2027.",
    },
  },
];
