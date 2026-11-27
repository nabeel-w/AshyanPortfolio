import { cacheLife, cacheTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { homeSections, pageSections, site as fallbackSite } from "@/content/fallback";

const db = vi.hoisted(() => ({
  siteSettings: { findUnique: vi.fn() },
  page: { findFirst: vi.fn() },
  project: { findMany: vi.fn() },
  client: { findMany: vi.fn() },
  label: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

const { chipLabels, getLabel, getLabels, getPublishedPage, getPublishedProjects, getSite, getWorkList } =
  await import("./queries");

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
  db.label.count.mockResolvedValue(0);
  db.label.findMany.mockResolvedValue([]);
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

  it("falls back to placeholder sections for the other known pages", async () => {
    db.page.findFirst.mockResolvedValue(null);
    expect((await getPublishedPage("about")).map((s) => s.type)).toEqual(pageSections.about.map((s) => s.type));
    expect((await getPublishedPage("contact"))[1]!.type).toBe("contactForm");
  });

  it("returns an empty list for unknown pages", async () => {
    db.page.findFirst.mockResolvedValue(null);
    expect(await getPublishedPage("press")).toEqual([]);
  });

  it("only queries published pages and visible sections, in order", async () => {
    db.page.findFirst.mockResolvedValue({ sections: [] });
    await getPublishedPage("home");
    expect(db.page.findFirst).toHaveBeenCalledWith({
      where: { slug: "home", status: "PUBLISHED" },
      include: { sections: { where: { publishedVisible: true }, orderBy: { publishedOrder: "asc" } } },
    });
    expect(cacheTag).toHaveBeenCalledWith("page:home", "projects", "clients", "labels");
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
        labels: [
          { order: 0, label: { name: "Commercial", slug: "commercial", visible: true } },
          { order: 1, label: { name: "Secret", slug: "secret", visible: false } },
        ],
        cover: {
          url: "https://cdn/real.webp",
          alt: "Real",
          width: 1600,
          height: 900,
          blurDataUrl: "data:x",
        },
        loop: { status: "READY", kind: "VIDEO", url: "https://x.public.blob.vercel-storage.com/loop.mp4", width: 720, height: 1280 },
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
        labels: [{ name: "Commercial", slug: "commercial" }],
        orientation: "landscape",
        cardSize: "auto",
        featured: undefined,
        cover: {
          src: "https://cdn/real.webp",
          alt: "Real",
          width: 1600,
          height: 900,
          blurDataUrl: "data:x",
        },
        loop: { src: "https://x.public.blob.vercel-storage.com/loop.mp4", width: 720, height: 1280 },
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
        loop: { url: "https://x.public.blob.vercel-storage.com/l.mp4", status: "PROCESSING" },
      },
    ]);
    const [item] = await getPublishedProjects();
    expect(item!.loop).toBeUndefined();
  });

  it("uses a Blob video picked as a loop (no playback id needed), but never an image", async () => {
    const base = { slug: "p", title: "P", createdAt: new Date("2026-01-01"), cover: { url: "https://cdn/p.webp", alt: "" } };
    db.project.findMany.mockResolvedValue([
      { ...base, loop: { url: "https://x.public.blob.vercel-storage.com/l.mp4", status: "READY", kind: "VIDEO", width: null, height: null } },
      { ...base, slug: "q", loop: { url: "https://cdn/still.webp", status: "READY", kind: "IMAGE" } },
    ]);
    const [blob, image] = await getPublishedProjects();
    expect(blob!.loop).toEqual({ src: "https://x.public.blob.vercel-storage.com/l.mp4" });
    expect(image!.loop).toBeUndefined();
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

describe("labels (#28)", () => {
  const project = (slug: string, labels: [string, boolean][]) => ({
    slug,
    title: slug.toUpperCase(),
    format: "Film",
    year: 2025,
    createdAt: new Date("2025-01-01"),
    cover: { url: `https://cdn/${slug}.webp`, alt: "" },
    labels: labels.map(([s, visible], order) => ({ order, label: { name: s[0]!.toUpperCase() + s.slice(1), slug: s, visible } })),
  });

  it("getLabels lists visible labels in admin order with published-film counts", async () => {
    db.label.count.mockResolvedValue(3);
    db.label.findMany.mockResolvedValue([
      { name: "Reels", slug: "reels", _count: { projects: 2 } },
      { name: "Fashion", slug: "fashion", _count: { projects: 0 } },
    ]);
    expect(await getLabels()).toEqual([
      { name: "Reels", slug: "reels", count: 2 },
      { name: "Fashion", slug: "fashion", count: 0 },
    ]);
    expect(db.label.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { visible: true } }));
    expect(cacheTag).toHaveBeenCalledWith("labels", "projects");
  });

  it("getLabels derives labels from the work list on a fresh database", async () => {
    db.label.count.mockResolvedValue(0);
    db.page.findFirst.mockResolvedValue(null);
    const labels = await getLabels();
    expect(labels.map((l) => l.slug)).toEqual(["commercial", "reels", "fashion", "music-video", "film", "documentary"]);
    expect(labels[0]!.count).toBe(2);
  });

  it("chipLabels: auto = labels with work; a list keeps its order and drops empty or unknown ones", () => {
    const all = [
      { name: "A", slug: "a", count: 1 },
      { name: "B", slug: "b", count: 0 },
      { name: "C", slug: "c", count: 3 },
    ];
    expect(chipLabels("auto", all).map((l) => l.slug)).toEqual(["a", "c"]);
    expect(chipLabels(["c", "b", "zzz", "a"], all).map((l) => l.slug)).toEqual(["c", "a"]);
  });

  it("getLabel returns the label and its published films; card tags skip hidden labels", async () => {
    db.label.count.mockResolvedValue(2);
    db.label.findUnique.mockResolvedValue({ id: "l1", name: "Fashion", slug: "fashion", visible: true, description: " Dresses. ", seoTitle: null, seoDescription: null });
    db.project.findMany.mockResolvedValue([project("a", [["fashion", true], ["secret", false]])]);
    const hit = await getLabel("fashion");
    expect(hit).toMatchObject({ label: { name: "Fashion", slug: "fashion", description: "Dresses." } });
    const label = (hit as { label: { projects: { labels: unknown[] }[] } }).label;
    expect(label.projects[0]!.labels).toEqual([{ name: "Fashion", slug: "fashion" }]);
    expect(db.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "PUBLISHED", labels: { some: { labelId: "l1" } } }) }),
    );
  });

  it("getLabel redirects a renamed label's old slug and hides hidden labels", async () => {
    db.label.count.mockResolvedValue(2);
    db.label.findUnique.mockResolvedValue(null);
    db.label.findFirst.mockResolvedValue({ slug: "fashion-films", visible: true });
    expect(await getLabel("fashion")).toEqual({ redirect: "fashion-films" });
    expect(db.label.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { previousSlugs: { has: "fashion" } } }));

    db.label.findFirst.mockResolvedValue(null);
    expect(await getLabel("gone")).toBeNull();

    db.label.findUnique.mockResolvedValue({ id: "l2", name: "Secret", slug: "secret", visible: false });
    expect(await getLabel("secret")).toBeNull();
  });

  it("hydrates the grid's chip rail from the Label table, and filters in place only on /work", async () => {
    db.page.findFirst.mockResolvedValue({ sections: [row(grid)] });
    db.project.findMany.mockResolvedValue([project("a", [["reels", true]])]);
    db.label.count.mockResolvedValue(1);
    db.label.findMany.mockResolvedValue([{ name: "Reels", slug: "reels", _count: { projects: 1 } }]);
    const [home] = await getPublishedPage("home");
    expect(home!.data).toMatchObject({ labelList: [{ name: "Reels", slug: "reels", count: 1 }], chips: "links" });
    const [work] = await getPublishedPage("work");
    expect(work!.data).toMatchObject({ chips: "filter" });
  });
});
