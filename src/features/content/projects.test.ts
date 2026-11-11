import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  project: { findFirst: vi.fn(), findMany: vi.fn() },
  page: { findFirst: vi.fn() },
  client: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

const { getProject, getProjectSlugs } = await import("./projects");

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
  film: { status: "READY", playbackId: "pb_film", duration: 20.1, url: "https://image.mux.com/pb_film/thumbnail.webp", meta: { aspectRatio: 16 / 9 } },
  loop: { status: "READY", playbackId: "pb_loop" },
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
      film: { playbackId: "pb_film", duration: 20.1, aspectRatio: 16 / 9 },
      loopPlaybackId: "pb_loop",
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

  it("hides a film that is still processing", async () => {
    db.project.findFirst.mockResolvedValue({ ...row, film: { ...row.film, status: "PROCESSING" } });
    expect((await getProject("resonance"))!.film).toBeUndefined();
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

describe("getProjectSlugs", () => {
  it("is never empty (Cache Components needs ≥ 1 static param)", async () => {
    db.project.findMany.mockResolvedValue([]);
    expect((await getProjectSlugs()).length).toBeGreaterThan(0);
  });
});
