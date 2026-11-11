import { cacheLife, cacheTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { homeSections, site as fallbackSite } from "@/content/fallback";

const db = vi.hoisted(() => ({
  siteSettings: { findUnique: vi.fn() },
  page: { findFirst: vi.fn() },
  project: { findMany: vi.fn() },
  client: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

const { getPublishedPage, getPublishedProjects, getSite, getWorkList } = await import("./queries");

const hero = homeSections.find((s) => s.type === "hero")!;
const grid = homeSections.find((s) => s.type === "workGrid")!;
const marquee = homeSections.find((s) => s.type === "clientMarquee")!;

const row = (s: (typeof homeSections)[number], overrides: object = {}) => ({
  id: `db_${s.id}`,
  type: s.type,
  visible: true,
  order: 0,
  data: s.data,
  publishedData: s.data,
  ...overrides,
});

beforeEach(() => {
  db.project.findMany.mockResolvedValue([]);
  db.client.findMany.mockResolvedValue([]);
});

describe("getSite", () => {
  it("falls back to placeholder content on an empty database", async () => {
    db.siteSettings.findUnique.mockResolvedValue(null);
    expect(await getSite()).toEqual(fallbackSite);
  });

  it("merges DB settings over the fallback and keeps static parts (nav)", async () => {
    db.siteSettings.findUnique.mockResolvedValue({
      name: "Ashyan Z.",
      role: "Editor & Colourist",
      location: null,
      email: "studio@ashyan.test",
      bio: "Bio from DB",
      socials: [{ label: "Vimeo", href: "https://vimeo.com/ashyan" }],
    });
    const site = await getSite();
    expect(site).toMatchObject({
      name: "Ashyan Z.",
      role: "Editor & Colourist",
      location: fallbackSite.location,
      email: "studio@ashyan.test",
      description: "Bio from DB",
      socials: [{ label: "Vimeo", href: "https://vimeo.com/ashyan" }],
      nav: fallbackSite.nav,
    });
  });

  it("ignores malformed socials JSON", async () => {
    db.siteSettings.findUnique.mockResolvedValue({
      name: "A",
      role: "B",
      socials: [{ label: "x", href: "not a url" }],
    });
    expect((await getSite()).socials).toEqual(fallbackSite.socials);
  });

  it("is cached forever and tagged 'site' so publishing refreshes it", async () => {
    db.siteSettings.findUnique.mockResolvedValue(null);
    await getSite();
    expect(cacheTag).toHaveBeenCalledWith("site");
    expect(cacheLife).toHaveBeenCalledWith("max");
  });
});

describe("getPublishedPage", () => {
  it("returns the fallback home page when nothing is published", async () => {
    db.page.findFirst.mockResolvedValue(null);
    expect(await getPublishedPage("home")).toBe(homeSections);
  });

  it("returns an empty list for other unpublished pages", async () => {
    db.page.findFirst.mockResolvedValue(null);
    expect(await getPublishedPage("about")).toEqual([]);
  });

  it("only queries published pages and visible sections, in order", async () => {
    db.page.findFirst.mockResolvedValue({ sections: [] });
    await getPublishedPage("home");
    expect(db.page.findFirst).toHaveBeenCalledWith({
      where: { slug: "home", status: "PUBLISHED" },
      include: { sections: { where: { visible: true }, orderBy: { order: "asc" } } },
    });
    expect(cacheTag).toHaveBeenCalledWith("page:home", "projects", "clients");
  });

  it("returns publishedData — never the draft", async () => {
    const draft = { ...hero.data, headline: "DRAFT — not live" };
    db.page.findFirst.mockResolvedValue({ sections: [row(hero, { data: draft })] });
    const [section] = await getPublishedPage("home");
    expect(section).toMatchObject({ id: "db_hero", type: "hero" });
    expect(section!.data).toMatchObject({ headline: (hero.data as { headline: string }).headline });
  });

  it("skips never-published, unknown and invalid sections without failing the page", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.page.findFirst.mockResolvedValue({
      sections: [
        row(hero),
        row(hero, { id: "draft_only", publishedData: null }),
        row(hero, { id: "unknown", type: "carousel3d" }),
        row(hero, { id: "broken", publishedData: { headline: 42 } }),
      ],
    });
    const sections = await getPublishedPage("home");
    expect(sections.map((s) => s.id)).toEqual(["db_hero"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('skipped invalid "hero" section broken'),
      expect.any(String),
    );
  });

  it("applies schema defaults to sparse published data", async () => {
    db.page.findFirst.mockResolvedValue({
      sections: [row(marquee, { publishedData: { clients: [{ name: "Nike" }] } })],
    });
    const [section] = await getPublishedPage("home");
    expect(section!.data).toEqual({ label: "Trusted by", speed: 45, clients: [{ name: "Nike" }] });
  });

  it("hydrates the work grid from published projects when there are any", async () => {
    db.page.findFirst.mockResolvedValue({ sections: [row(grid)] });
    db.project.findMany.mockResolvedValue([
      {
        slug: "real-film",
        title: "Real Film",
        format: "Commercial",
        year: 2026,
        createdAt: new Date("2026-01-01"),
        category: { name: "Commercial" },
        cover: {
          url: "https://cdn/real.webp",
          alt: "Real",
          width: 1600,
          height: 900,
          blurDataUrl: "data:x",
        },
        loop: { playbackId: "pb_loop", status: "READY" },
      },
    ]);
    const [section] = await getPublishedPage("home");
    expect(section!.type).toBe("workGrid");
    expect((section!.data as { projects: unknown[] }).projects).toEqual([
      {
        slug: "real-film",
        title: "Real Film",
        format: "Commercial",
        year: 2026,
        category: "Commercial",
        cover: {
          src: "https://cdn/real.webp",
          alt: "Real",
          width: 1600,
          height: 900,
          blurDataUrl: "data:x",
        },
        loopPlaybackId: "pb_loop",
      },
    ]);
  });

  it("ignores hover loops that are still processing", async () => {
    db.project.findMany.mockResolvedValue([
      {
        slug: "p",
        title: "P",
        createdAt: new Date("2026-01-01"),
        cover: { url: "https://cdn/p.webp", alt: "" },
        loop: { playbackId: "pb", status: "PROCESSING" },
      },
    ]);
    const [item] = await getPublishedProjects();
    expect(item!.loopPlaybackId).toBeUndefined();
  });

  it("hydrates the marquee from client rows", async () => {
    db.page.findFirst.mockResolvedValue({ sections: [row(marquee)] });
    db.client.findMany.mockResolvedValue([
      { name: "Sony", logo: { url: "https://cdn/sony.svg", width: 120, height: 40 } },
    ]);
    const [section] = await getPublishedPage("home");
    expect((section!.data as { clients: unknown[] }).clients).toEqual([
      { name: "Sony", logo: { src: "https://cdn/sony.svg", alt: "Sony", width: 120, height: 40 } },
    ]);
  });

  it("does not swallow database errors", async () => {
    db.page.findFirst.mockRejectedValue(new Error("connection refused"));
    await expect(getPublishedPage("home")).rejects.toThrow("connection refused");
  });
});

describe("getPublishedProjects / getWorkList", () => {
  it("only asks for published projects with a ready cover, featured first", async () => {
    await getPublishedProjects();
    expect(db.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED", cover: { status: "READY" } },
        orderBy: [{ featured: "desc" }, { order: "asc" }, { publishedAt: "desc" }],
      }),
    );
  });

  it("drops projects whose cover has no URL", async () => {
    db.project.findMany.mockResolvedValue([
      { slug: "x", title: "X", createdAt: new Date(), cover: { url: null } },
    ]);
    expect(await getPublishedProjects()).toEqual([]);
  });

  it("work list falls back to the home grid's projects", async () => {
    db.page.findFirst.mockResolvedValue(null);
    const list = await getWorkList();
    expect(list.map((p) => p.slug)).toEqual(
      (grid.data as { projects: { slug: string }[] }).projects.map((p) => p.slug),
    );
  });
});
