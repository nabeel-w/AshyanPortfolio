/**
 * pnpm seed:media <clips-dir>
 *
 * Pushes the on-brand stand-in media through the REAL storage pipeline and creates the demo projects:
 *   - stills from public/media → Vercel Blob (blur + dominant colour), incl. two 9:16 reel covers
 *   - loop-<still>.mp4 from <clips-dir> → Vercel Blob as hover loops (purpose "loop", ffprobe size)
 *   - 7 published projects: 5 landscape films and 2 reels (YouTube Shorts), labels, credits, story
 * Films are unlisted YouTube stand-ins (FILMS below), cut from the same footage as each project's loop.
 * Idempotent: media already ingested (matched by filename) is reused. Existing projects keep their
 * text, but get the v2 fields (YouTube film, orientation, labels, Blob loop) when those are missing.
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
    labels: ["Commercial"],
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
    labels: ["Commercial"],
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
    labels: ["Fashion"],
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
    labels: ["Film"],
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
    labels: ["Documentary"],
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
  {
    slug: "night-shift",
    title: "Night Shift",
    format: "Reel",
    clientName: "Atelier Rouge",
    year: 2025,
    labels: ["Reels", "Fashion"],
    role: "Edit · Colour",
    summary: "A vertical cut of the Atelier Rouge campaign: one red dress, one gust of wind, twelve seconds.",
    story:
      "Built for Reels and Shorts first, not cropped from the hero film: every shot was re-framed for 9:16 so the dress fills the screen.\n\nThe pace is set by the wind in the fabric rather than the music, which keeps the loop seamless.",
    credits: [
      { role: "Creative Director", name: "Léa Martin" },
      { role: "Editor & Colourist", name: "Ashyan Zafar" },
    ],
    still: "night-shift",
    featured: true,
  },
  {
    slug: "monsoon",
    title: "Monsoon",
    format: "Reel",
    clientName: "City Stories",
    year: 2025,
    labels: ["Reels", "Music video"],
    role: "Edit",
    summary: "A vertical music piece for the first rain over Mumbai, cut to the sound of the storm rolling in.",
    story:
      "A companion reel to Mumbai, My City. The skyline holds while the light changes, and the cut lands on each roll of thunder.",
    credits: [
      { role: "Director", name: "Ananya Iyer" },
      { role: "Editor", name: "Ashyan Zafar" },
    ],
    still: "monsoon",
    featured: true,
  },
];

/** Unlisted YouTube stand-ins (uploaded 2026-11-27), each cut from that project's own footage. */
const FILMS: Record<string, { url: string; orientation: "LANDSCAPE" | "PORTRAIT"; duration: number }> = {
  "the-next-chapter": { url: "https://youtu.be/SrDRTk-Rjn8", orientation: "LANDSCAPE", duration: 11.8 },
  "drive-further": { url: "https://youtu.be/J6PTOXRglIM", orientation: "LANDSCAPE", duration: 11.8 },
  resonance: { url: "https://youtu.be/hMZKq3msI1k", orientation: "LANDSCAPE", duration: 11.8 },
  "the-silent-ones": { url: "https://youtu.be/v_U_oxVl1TI", orientation: "LANDSCAPE", duration: 11.8 },
  "mumbai-my-city": { url: "https://youtu.be/rnmxUrigHHo", orientation: "LANDSCAPE", duration: 11.8 },
  "night-shift": { url: "https://youtube.com/shorts/aF2EFIDIKGU", orientation: "PORTRAIT", duration: 11.8 },
  monsoon: { url: "https://youtube.com/shorts/7bFb7t08OW0", orientation: "PORTRAIT", duration: 11.8 },
};

/** Label order on the site (chips, label pages). */
const LABELS = ["Commercial", "Reels", "Fashion", "Music video", "Film", "Documentary"];

const STILL_ALTS: Record<string, string> = {
  hero: "A woman in a dark coat looks skyward beside brutalist concrete, a thin red rim light on her profile",
  "next-chapter": "Extreme close-up of an eye under dappled leaf shadows with a red glint",
  "drive-further": "Black sports car under a concrete bridge at night, red tail light on wet asphalt",
  resonance: "Model in a flowing red silk dress on a black-sand coastline",
  "silent-ones": "Profile silhouette of a man in backlit smoke",
  mumbai: "Mumbai skyline at blue hour with red aircraft lights on the towers",
  studio: "Ashyan at a dark edit suite, a red playhead on the timeline",
  "night-shift": "A woman in a red silk dress turns into the wind against a grey sky",
  monsoon: "Mumbai towers under heavy monsoon cloud at dusk",
};

/** Width, height and duration of a clip (ffprobe; optional). */
async function probe(file: string) {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { stdout } = await promisify(execFile)("ffprobe", [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file,
    ]);
    const j = JSON.parse(stdout) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
    return { width: j.streams?.[0]?.width, height: j.streams?.[0]?.height, duration: Number(j.format?.duration) || undefined };
  } catch {
    return {};
  }
}

async function main() {
  const clipsDir = process.argv[2];
  if (!clipsDir) throw new Error("Usage: pnpm seed:media <dir with loop-<still>.mp4 per project>");

  const { db } = await import("../src/lib/db");
  const media = await import("../src/features/media/service");
  const { parseYouTubeUrl } = await import("../src/lib/youtube");
  const { slugify } = await import("../src/features/sections/schemas");

  async function ensure(
    filename: string,
    load: () => Promise<Buffer>,
    mimeType: string,
    alt: string,
    extra: { purpose?: "loop"; probe?: { width?: number; height?: number; duration?: number } } = {},
  ) {
    const existing = await db.asset.findFirst({
      where: { filename, status: "READY", provider: { not: "mux" } },
    });
    if (existing) return existing;
    const asset = await media.ingest(await load(), { filename, mimeType, alt, ...extra });
    console.log(`  ↑ ${filename} → ${asset.provider} (${asset.status})`);
    return asset;
  }

  console.log("Stills → image provider");
  const stills: Record<string, Awaited<ReturnType<typeof ensure>>> = {};
  for (const [name, alt] of Object.entries(STILL_ALTS)) {
    stills[name] = await ensure(`seed-${name}.webp`, () => readFile(path.join("public/media", `${name}.webp`)), "image/webp", alt);
  }

  console.log("Loops → video provider (Blob)");
  const loops: Record<string, Awaited<ReturnType<typeof ensure>>> = {};
  for (const p of PROJECTS) {
    const file = path.join(clipsDir, `loop-${p.still}.mp4`);
    loops[p.slug] = await ensure(`seed-loop-${p.still}.mp4`, () => readFile(file), "video/mp4", `${p.title} — preview loop`, {
      purpose: "loop",
      probe: await probe(file),
    });
  }

  console.log("Labels");
  const labelIds = new Map<string, string>();
  for (const [order, name] of LABELS.entries()) {
    const slug = slugify(name);
    const l = await db.label.upsert({ where: { slug }, update: { order }, create: { name, slug, order } });
    labelIds.set(name, l.id);
  }

  console.log("Projects");
  for (const [order, p] of PROJECTS.entries()) {
    const film = FILMS[p.slug]!;
    const parsed = parseYouTubeUrl(film.url)!;
    const v2 = {
      filmUrl: film.url,
      filmYoutubeId: parsed.id,
      filmOrientation: film.orientation,
      filmDuration: film.duration,
      loopId: loops[p.slug]!.id,
    };
    const labels = p.labels.map((name, i) => ({ labelId: labelIds.get(name)!, order: i }));
    const existing = await db.project.findUnique({
      where: { slug: p.slug },
      include: { loop: true, labels: true },
    });
    if (existing) {
      // Keep the text; fill in what v2 needs.
      await db.project.update({
        where: { id: existing.id },
        data: {
          ...(existing.filmYoutubeId ? {} : { filmUrl: v2.filmUrl, filmYoutubeId: v2.filmYoutubeId, filmOrientation: v2.filmOrientation, filmDuration: v2.filmDuration }),
          ...(existing.loop && existing.loop.provider !== "mux" ? {} : { loopId: v2.loopId }),
          ...(existing.labels.length ? {} : { labels: { create: labels } }),
        },
      });
      console.log(`  ~ ${p.slug} (v2 fields filled in)`);
      continue;
    }
    await db.project.create({
      data: {
        slug: p.slug,
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
        status: "PUBLISHED",
        publishedAt: new Date(Date.UTC(p.year, 5, 1)),
        coverId: stills[p.still]!.id,
        ...v2,
        labels: { create: labels },
      },
    });
    console.log(`  + ${p.slug}`);
  }
  await db.$disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
