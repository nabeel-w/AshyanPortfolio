/**
 * pnpm seed:media <clips-dir>
 *
 * Pushes the on-brand stand-in media through the REAL storage pipeline and creates demo projects:
 *   - 7 stills from public/media → image provider (Vercel Blob), with blur + dominant colour
 *   - loop-<slug>.mp4 + showreel.mp4 from <clips-dir> → video provider (Mux), waits until READY
 *   - 5 published projects (covers, hover loops, the showreel as the film), categories, credits, story
 * Idempotent: media already ingested (matched by filename) and existing projects are reused.
 * Replace with real work through /admin before launch.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

const PROJECTS = [
  {
    slug: "the-next-chapter",
    title: "The Next Chapter",
    format: "Brand Film",
    clientName: "Maison Noor",
    year: 2024,
    category: "Commercial",
    role: "Edit · Colour · Sound design",
    summary: "A brand film about beginnings, cut around a single held gaze and the quiet before a decision.",
    story:
      "The brief was to make a skincare launch feel like the first page of a novel rather than an advert.\n\nWe built the edit around one unbroken close-up, letting light and shadow do the storytelling and holding shots far longer than a typical spot, so the product arrives as a consequence instead of a claim.\n\nThe grade pushes everything toward monochrome and lets a single warm-red glint carry the brand colour.",
    credits: [
      { role: "Director", name: "Sara Qureshi" },
      { role: "Editor & Colourist", name: "Ashyan Zafar" },
      { role: "DOP", name: "Imran Sheikh" },
    ],
    still: "next-chapter",
    featured: true,
  },
  {
    slug: "drive-further",
    title: "Drive Further",
    format: "Commercial",
    clientName: "Atlas Motors",
    year: 2024,
    category: "Commercial",
    role: "Edit · Sound design",
    summary: "A night-drive commercial cut to engine rhythm, where every cut lands on a beat of the road.",
    story:
      "Shot over two nights under the city's flyovers, the footage had beautiful texture but no story. The edit found one: a driver who never quite arrives.\n\nCuts are timed to the engine's RPM curve, and the sound design carries the tension the visuals deliberately hold back.",
    credits: [
      { role: "Agency", name: "Northbound" },
      { role: "Editor", name: "Ashyan Zafar" },
    ],
    still: "drive-further",
    featured: true,
  },
  {
    slug: "resonance",
    title: "Résonance",
    format: "Fashion Film",
    clientName: "Atelier Rouge",
    year: 2023,
    category: "Fashion",
    role: "Edit · Colour",
    summary: "A fashion film where a single red dress moves through a monochrome coastline, cut to breath and wind.",
    story:
      "Résonance is about movement as memory. We cut on the fabric rather than the model, so every transition follows the dress.\n\nThe grade isolates the red completely, so the collection reads instantly even at thumbnail size.",
    credits: [
      { role: "Creative Director", name: "Léa Martin" },
      { role: "Editor & Colourist", name: "Ashyan Zafar" },
    ],
    still: "resonance",
    featured: true,
  },
  {
    slug: "the-silent-ones",
    title: "The Silent Ones",
    format: "Short Film",
    clientName: "Independent",
    year: 2023,
    category: "Film",
    role: "Edit",
    summary: "A short film about the words we never say, built from long takes, smoke and silence.",
    story:
      "With almost no dialogue, the edit carries the narrative entirely through pacing. Scenes breathe, cuts arrive late, and silence becomes a character.\n\nSelected for two regional festivals in 2023.",
    credits: [
      { role: "Writer / Director", name: "Kabir Rao" },
      { role: "Editor", name: "Ashyan Zafar" },
    ],
    still: "silent-ones",
    featured: false,
  },
  {
    slug: "mumbai-my-city",
    title: "Mumbai, My City",
    format: "Documentary",
    clientName: "City Stories",
    year: 2022,
    category: "Documentary",
    role: "Edit · Story",
    summary: "A documentary portrait of Mumbai at blue hour, told through the people who keep it awake.",
    story:
      "Forty hours of verité footage became a twelve-minute portrait. The structure follows a single night, from the last local train to the first chai.\n\nThe edit finds rhythm in the city's noise, then drops into silence for the moments that matter.",
    credits: [
      { role: "Director", name: "Ananya Iyer" },
      { role: "Editor", name: "Ashyan Zafar" },
    ],
    still: "mumbai",
    featured: false,
  },
];

const STILL_ALTS: Record<string, string> = {
  hero: "A woman in a dark coat looks skyward beside brutalist concrete, a thin red rim light on her profile",
  "next-chapter": "Extreme close-up of an eye under dappled leaf shadows with a red glint",
  "drive-further": "Black sports car under a concrete bridge at night, red tail light on wet asphalt",
  resonance: "Model in a flowing red silk dress on a black-sand coastline",
  "silent-ones": "Profile silhouette of a man in backlit smoke",
  mumbai: "Mumbai skyline at blue hour with red aircraft lights on the towers",
  studio: "Ashyan at a dark edit suite, a red playhead on the timeline",
};

async function main() {
  const clipsDir = process.argv[2];
  if (!clipsDir) throw new Error("Usage: pnpm seed:media <dir with loop-<slug>.mp4 and showreel.mp4>");

  const { db } = await import("../src/lib/db");
  const media = await import("../src/features/media/service");

  async function ensure(filename: string, load: () => Promise<Buffer>, mimeType: string, alt: string) {
    const existing = await db.asset.findFirst({ where: { filename, status: { not: "ERRORED" } } });
    if (existing) return existing;
    const asset = await media.ingest(await load(), { filename, mimeType, alt });
    console.log(`  ↑ ${filename} → ${asset.provider} (${asset.status})`);
    return asset;
  }

  async function waitReady(id: string) {
    for (let i = 0; i < 60; i++) {
      const a = await media.completeUpload(id);
      if (a.status === "READY" || a.status === "ERRORED") return a;
      await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error(`Asset ${id} still processing after 5 minutes`);
  }

  console.log("Stills → image provider");
  const stills: Record<string, Awaited<ReturnType<typeof ensure>>> = {};
  for (const [name, alt] of Object.entries(STILL_ALTS)) {
    stills[name] = await ensure(`seed-${name}.webp`, () => readFile(path.join("public/media", `${name}.webp`)), "image/webp", alt);
  }

  console.log("Clips → video provider");
  const showreel = await ensure("seed-showreel.mp4", () => readFile(path.join(clipsDir, "showreel.mp4")), "video/mp4", "Ashyan Zafar showreel");
  const loops: Record<string, Awaited<ReturnType<typeof ensure>>> = {};
  for (const p of PROJECTS) {
    loops[p.slug] = await ensure(`seed-loop-${p.still}.mp4`, () => readFile(path.join(clipsDir, `loop-${p.still}.mp4`)), "video/mp4", `${p.title} — preview loop`);
  }

  console.log("Waiting for video processing…");
  for (const a of [showreel, ...Object.values(loops)]) {
    if (a.status !== "READY") {
      const done = await waitReady(a.id);
      console.log(`  ✓ ${done.filename}: ${done.status}${done.playbackId ? ` (${done.playbackId})` : ""}`);
    }
  }

  console.log("Projects");
  const categories = new Map<string, string>();
  for (const [i, name] of ["Commercial", "Fashion", "Film", "Documentary"].entries()) {
    const c = await db.category.upsert({
      where: { slug: name.toLowerCase() },
      update: {},
      create: { name, slug: name.toLowerCase(), order: i },
    });
    categories.set(name, c.id);
  }
  for (const [order, p] of PROJECTS.entries()) {
    const data = {
      title: p.title,
      format: p.format,
      clientName: p.clientName,
      year: p.year,
      role: p.role,
      summary: p.summary,
      story: p.story,
      credits: p.credits,
      featured: p.featured,
      order,
      status: "PUBLISHED" as const,
      publishedAt: new Date(Date.UTC(p.year, 5, 1)),
      categoryId: categories.get(p.category)!,
      coverId: stills[p.still]!.id,
      loopId: loops[p.slug]!.id,
      filmId: showreel.id,
    };
    const existing = await db.project.findUnique({ where: { slug: p.slug } });
    if (existing) console.log(`  = ${p.slug} (exists, left unchanged)`);
    else {
      await db.project.create({ data: { slug: p.slug, ...data } });
      console.log(`  + ${p.slug}`);
    }
  }
  await db.$disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
