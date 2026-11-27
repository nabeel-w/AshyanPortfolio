import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  project: { findFirst: vi.fn(), findMany: vi.fn() },
  page: { findFirst: vi.fn() },
  client: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

const { getProject, getProjectSlugs, projectMeta } = await import("./projects");

const ready = (over: object = {}) => ({ status: "READY", url: "https://cdn/c.webp", alt: "Cover", width: 1600, height: 900, blurDataUrl: "data:x", ...over });

const row = {
  slug: "resonance",
  title: "Résonance",
  format: "Fashion Film",
  clientName: "Atelier Rouge",
  year: 2023,
  role: "Edit · Colour",
  summary: "Short summary.",
  story: "First paragraph.\n\n  Second paragraph.  \n\n\n",
  credits: [{ role: "Editor", name: "Ashyan Zafar" }],
  createdAt: new Date("2023-01-01"),
  updatedAt: new Date("2023-02-01"),
  publishedAt: new Date("2023-06-01"),
  category: { name: "Fashion" },
  cover: ready(),
  filmUrl: "https://youtu.be/dQw4w9WgXcQ?t=5",
  filmYoutubeId: "dQw4w9WgXcQ",
  filmOrientation: "LANDSCAPE",
  filmAspect: null,
  filmDuration: 20.1,
  loop: { status: "READY", kind: "VIDEO", url: "https://x.public.blob.vercel-storage.com/loop.mp4", width: 1080, height: 1920 },
  gallery: [{ asset: ready({ url: "https://cdn/g1.webp" }) }, { asset: ready({ status: "PROCESSING" }) }],
};

beforeEach(() => {
  db.project.findMany.mockResolvedValue([
    { slug: "resonance", title: "Résonance", cover: ready() },
    { slug: "mumbai", title: "Mumbai", cover: ready({ url: "https://cdn/m.webp" }) },
  ]);
  db.page.findFirst.mockResolvedValue(null);
  db.client.findMany.mockResolvedValue([]);
});

describe("getProject", () => {
  it("maps a published project to the page model", async () => {
    db.project.findFirst.mockResolvedValue(row);
    const p = await getProject("resonance");
    expect(p).toMatchObject({
      slug: "resonance",
      category: "Fashion",
      story: ["First paragraph.", "Second paragraph."],
      credits: [{ role: "Editor", name: "Ashyan Zafar" }],
      cover: { src: "https://cdn/c.webp", alt: "Cover", blurDataUrl: "data:x" },
      film: {
        youtubeId: "dQw4w9WgXcQ",
        kind: "video",
        orientation: "landscape",
        aspect: 16 / 9,
        duration: 20.1,
        start: 5,
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        watchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        poster: { src: "https://cdn/c.webp" },
      },
      loop: { src: "https://x.public.blob.vercel-storage.com/loop.mp4", width: 1080, height: 1920 },
      next: { slug: "mumbai", title: "Mumbai" },
    });
    // gallery skips assets that aren't ready yet
    expect(p!.gallery.map((g) => g.src)).toEqual(["https://cdn/g1.webp"]);
  });

  it("only looks up published projects", async () => {
    db.project.findFirst.mockResolvedValue(row);
    await getProject("resonance");
    expect(db.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: "resonance", status: "PUBLISHED" } }));
  });

  it("has no film without a valid YouTube URL, or when the stored id disagrees with it", async () => {
    db.project.findFirst.mockResolvedValue({ ...row, filmUrl: null });
    expect((await getProject("resonance"))!.film).toBeUndefined();
    db.project.findFirst.mockResolvedValue({ ...row, filmUrl: "https://youtube.com.evil.io/watch?v=dQw4w9WgXcQ" });
    expect((await getProject("resonance"))!.film).toBeUndefined();
    db.project.findFirst.mockResolvedValue({ ...row, filmYoutubeId: "aaaaaaaaaaa" });
    expect((await getProject("resonance"))!.film).toBeUndefined();
  });

  it("gives Shorts a portrait 9:16 box, and honours an exact aspect", async () => {
    db.project.findFirst.mockResolvedValue({ ...row, filmUrl: "https://youtube.com/shorts/dQw4w9WgXcQ", filmOrientation: "PORTRAIT" });
    expect((await getProject("resonance"))!.film).toMatchObject({ kind: "short", orientation: "portrait", aspect: 9 / 16, watchUrl: "https://www.youtube.com/shorts/dQw4w9WgXcQ" });
    db.project.findFirst.mockResolvedValue({ ...row, filmAspect: 2.39 });
    expect((await getProject("resonance"))!.film!.aspect).toBe(2.39);
  });

  it("tolerates malformed credits JSON", async () => {
    db.project.findFirst.mockResolvedValue({ ...row, credits: "oops" });
    expect((await getProject("resonance"))!.credits).toEqual([]);
  });

  it("returns null when the cover isn't ready (page would have no hero)", async () => {
    db.project.findFirst.mockResolvedValue({ ...row, cover: ready({ status: "UPLOADING" }) });
    expect(await getProject("resonance")).toBeNull();
  });

  it("falls back to placeholder projects on an empty database, and null for unknown slugs", async () => {
    db.project.findFirst.mockResolvedValue(null);
    db.project.findMany.mockResolvedValue([]);
    expect(await getProject("the-next-chapter")).toMatchObject({ slug: "the-next-chapter", title: "The Next Chapter" });
    expect(await getProject("does-not-exist")).toBeNull();
  });
});

describe("project SEO fields (#31)", () => {
  it("carries the admin SEO title and description", async () => {
    db.project.findFirst.mockResolvedValue({ ...row, seoTitle: " Résonance, a fashion film ", seoDescription: "Custom description." });
    const p = (await getProject("resonance"))!;
    expect(p).toMatchObject({ seoTitle: "Résonance, a fashion film", seoDescription: "Custom description." });
    expect(projectMeta(p)).toEqual({ title: "Résonance, a fashion film", description: "Custom description." });
  });

  it("falls back to Title — Format and the summary when the fields are empty", async () => {
    db.project.findFirst.mockResolvedValue({ ...row, seoTitle: "", seoDescription: null });
    const p = (await getProject("resonance"))!;
    expect(projectMeta(p)).toEqual({ title: "Résonance — Fashion Film", description: "Short summary." });
    expect(projectMeta({ ...p, summary: "" }).description).toBe("Résonance, a fashion film edited by Ashyan Zafar.");
  });
});

describe("getProjectSlugs", () => {
  it("is never empty (Cache Components needs ≥ 1 static param)", async () => {
    db.project.findMany.mockResolvedValue([]);
    expect((await getProjectSlugs()).length).toBeGreaterThan(0);
  });
});
