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
    { label: "YouTube", href: "https://youtube.com/" },
  ],
  nav: [
    { label: "Home", href: "/" },
    { label: "Work", href: "/work" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
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
      cta: { label: "More about me", href: "/about" },
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

const workGrid = homeSections.find((s) => s.type === "workGrid")!;

/** Placeholder sections for the inner pages. Seeded into the DB, then edited in /admin/pages. */
export const pageSections: Record<"home" | "work" | "about" | "contact", SectionData[]> = {
  home: homeSections,
  work: [
    {
      id: "work-header",
      type: "pageHeader",
      visible: true,
      data: {
        eyebrow: "Explore",
        title: "Selected *films.*",
        intro:
          "Commercials, fashion films, documentaries and short films — edited for pace, performance and the quiet moments between.",
      },
    },
    { ...workGrid, id: "work-grid", data: { ...workGrid.data, label: "All work" } } as SectionData,
  ],
  about: [
    {
      id: "about-header",
      type: "pageHeader",
      visible: true,
      data: {
        eyebrow: "About",
        title: "Your next story *starts in the edit.*",
        intro: "Independent film editor for brands, agencies and directors. From first assembly to final master.",
      },
    },
    {
      id: "about-bio",
      type: "bio",
      visible: true,
      data: {
        media: img("studio", 1448, 1086, "Ashyan at a dark edit suite, a red playhead on the timeline"),
        stats: [
          { value: "8+", label: "Years editing" },
          { value: "150+", label: "Projects" },
          { value: "60+", label: "Brands" },
          { value: "12", label: "Festivals" },
        ],
        body: [
          "I'm Ashyan Zafar, an independent film editor based in India and working with teams worldwide.",
          "I cut commercials, brand films, fashion films and documentaries — work that has to land in seconds but stay with people much longer. My process starts with the material: finding the rhythm in the footage before deciding what the story needs.",
          "Beyond the cut I handle colour, sound design and finishing, so a film can go from rushes to delivery with one consistent hand on it.",
          "I work remotely and plug into agency pipelines, shared storage and review tools, keeping projects moving without friction.",
        ].join("\n\n"),
      },
    },
    {
      id: "about-services",
      type: "services",
      visible: true,
      data: {
        eyebrow: "What I do",
        title: "Beyond *the timeline*",
        items: [
          { title: "Film editing", description: "From first assembly to final master: commercials, brand films, fashion films and documentaries, cut with precision and on deadline.", tag: "Core" },
          { title: "Colour grading", description: "A considered grade that carries the story — from naturalistic documentary looks to stylised campaign palettes.", tag: "Finishing" },
          { title: "Sound design", description: "Atmosphere, rhythm and mix built alongside the edit, so picture and sound land together.", tag: "Finishing" },
          { title: "Motion graphics", description: "Titles, supers and graphic moments designed to live naturally inside the cut.", tag: "Post-production" },
          { title: "Pitch & mood films", description: "Mood reels and pitch films assembled from curated footage to sell an idea before a frame is shot.", tag: "Pre-production" },
          { title: "Social cut-downs", description: "Vertical and short-form versions that keep the craft of the hero film.", tag: "Delivery" },
        ],
      },
    },
    {
      id: "about-clients",
      type: "clientList",
      visible: true,
      data: {
        eyebrow: "Trusted by",
        title: "*Clients*",
        groups: [
          { label: "Brands", names: ["Netflix", "Nike", "Vogue", "Red Bull", "Audi", "Sony", "Zara", "Spotify", "Hermès", "BBC"] },
          { label: "Agencies", names: ["Northbound", "Studio Ten", "Maison Noor Creative"] },
          { label: "Production companies", names: ["City Stories", "Atelier Rouge Films"] },
        ],
      },
    },
    {
      id: "about-faq",
      type: "faq",
      visible: true,
      data: {
        eyebrow: "Questions",
        title: "Working *together*",
        items: [
          {
            question: "What does a film editor do on a commercial?",
            answer:
              "On a commercial I turn the shoot into a story that lands in seconds. I build the structure, choose performances, set the rhythm against music and sound, and shape cut-downs for every format — working with the director and agency from first assembly through to the final graded, mixed master.",
          },
          {
            question: "How long does it take to edit a brand film?",
            answer:
              "A 60–90 second brand film usually takes one to two weeks: an assembly in two or three days, then review rounds with the director and client, followed by colour, sound and delivery. Documentaries and long-form projects are scoped individually once I have seen the material and the deadline.",
          },
          {
            question: "Do you work remotely with teams outside India?",
            answer:
              "Yes — most of my projects are remote. I work from shared storage or proxies, plug into your review tools, and keep to your time zone for feedback sessions. Fast, secure transfers and clear versioning mean a remote edit runs as smoothly as having me in the room.",
          },
          {
            question: "Can you also handle colour grading and sound?",
            answer:
              "I do. Many clients prefer one consistent hand from the first cut to the final master, so I offer colour grading, sound design and finishing alongside the edit. On larger productions I work with dedicated colourists and mixers and manage the turnover so nothing gets lost between departments.",
          },
        ],
      },
    },
    {
      id: "about-cta",
      type: "contactCta",
      visible: true,
      data: {
        label: "Availability",
        headline: "Currently taking on *new projects.*",
        email: "hello@ashyanzafar.com",
        note: "Freelance · Remote · Worldwide",
      },
    },
  ],
  contact: [
    {
      id: "contact-header",
      type: "pageHeader",
      visible: true,
      data: {
        eyebrow: "Contact",
        title: "Tell me about *your project.*",
        intro: "Available for freelance and remote collaborations worldwide.\nSend the details and I'll get back to you within 24 hours.",
      },
    },
    {
      id: "contact-form",
      type: "contactForm",
      visible: true,
      data: {
        projectTypes: ["Commercial", "Brand Film", "Fashion Film", "Music Video", "Documentary", "Other"],
        submitLabel: "Send message",
        successMessage: "Thank you — I'll get back to you within 24 hours.",
        location: "India",
        availability: "Currently available for selected projects worldwide.",
        bookingUrl: "",
        askAi: true,
      },
    },
  ],
};
