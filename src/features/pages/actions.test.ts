import { beforeEach, describe, expect, it, vi } from "vitest";
import { homeSections } from "@/content/fallback";

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({ requireAdmin }));

const invalidate = vi.hoisted(() => ({ page: vi.fn() }));
vi.mock("@/features/content/invalidate", () => ({ invalidate }));

const db = vi.hoisted(() => {
  const tx = vi.fn(async (arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : undefined));
  return {
    $transaction: tx,
    section: {
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(async (args: unknown) => args),
      delete: vi.fn(async (args: unknown) => args),
      create: vi.fn(async () => ({ id: "new_section" })),
      upsert: vi.fn(async (args: unknown) => args),
    },
    page: { findUniqueOrThrow: vi.fn(), update: vi.fn(async (args: unknown) => args) },
    pageRevision: { create: vi.fn(async (args: unknown) => args), findUniqueOrThrow: vi.fn() },
  };
});
vi.mock("@/lib/db", () => ({ db }));

const actions = await import("./actions");
const hero = homeSections.find((s) => s.type === "hero")!;

beforeEach(() => {
  requireAdmin.mockResolvedValue({ user: { id: "admin_1" } });
});

describe("page editor actions", () => {
  it("refuse everything without an admin session", async () => {
    requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(actions.saveSectionDraft("s1", {})).rejects.toThrow("NEXT_REDIRECT");
    await expect(actions.publishPage("p1")).rejects.toThrow("NEXT_REDIRECT");
    await expect(actions.discardDrafts("p1")).rejects.toThrow("NEXT_REDIRECT");
    expect(db.section.update).not.toHaveBeenCalled();
  });

  describe("saveSectionDraft", () => {
    it("validates against the section schema and returns field errors by path", async () => {
      db.section.findUniqueOrThrow.mockResolvedValue({ id: "s1", type: "hero" });
      const res = await actions.saveSectionDraft("s1", { ...hero.data, headline: 42, cta: { label: "Go" } });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(Object.keys(res.errors)).toEqual(expect.arrayContaining(["headline", "cta.href"]));
      expect(db.section.update).not.toHaveBeenCalled();
    });

    it("stores the parsed draft only (never the live columns)", async () => {
      db.section.findUniqueOrThrow.mockResolvedValue({ id: "s1", type: "hero" });
      db.section.update.mockResolvedValueOnce({ updatedAt: new Date("2026-01-01T00:00:00Z") } as never);
      const res = await actions.saveSectionDraft("s1", { ...hero.data, headline: "New *headline*" });
      expect(res).toEqual({ ok: true, savedAt: "2026-01-01T00:00:00.000Z" });
      const { data } = db.section.update.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(Object.keys(data)).toEqual(["data"]);
      expect((data.data as { headline: string }).headline).toBe("New *headline*");
    });
  });

  describe("publishPage", () => {
    const sections = [
      { id: "a", type: "hero", order: 1, visible: true, data: hero.data },
      { id: "b", type: "statement", order: 0, visible: false, data: { text: "Hi" } },
    ];

    it("copies drafts to the live columns, snapshots a revision and refreshes the page cache", async () => {
      db.page.findUniqueOrThrow.mockResolvedValue({ id: "p1", slug: "home", sections });
      expect(await actions.publishPage("p1", "launch")).toEqual({ ok: true });

      const updates = db.section.update.mock.calls.map((c) => c[0] as { where: { id: string }; data: Record<string, unknown> });
      expect(updates).toContainEqual({
        where: { id: "b" },
        data: { publishedData: { text: "Hi" }, publishedOrder: 0, publishedVisible: false },
      });
      expect(db.pageRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ pageId: "p1", authorId: "admin_1", note: "launch" }) }),
      );
      expect(invalidate.page).toHaveBeenCalledWith("home");
    });

    it("refuses to publish invalid content", async () => {
      db.page.findUniqueOrThrow.mockResolvedValue({
        id: "p1",
        slug: "home",
        sections: [{ ...sections[0], data: { headline: 1 } }],
      });
      const res = await actions.publishPage("p1");
      expect(res.ok).toBe(false);
      expect(db.section.update).not.toHaveBeenCalled();
      expect(invalidate.page).not.toHaveBeenCalled();
    });
  });

  describe("removeSection", () => {
    it("deletes sections that were never published", async () => {
      db.section.findUniqueOrThrow.mockResolvedValue({ id: "s1", publishedData: null });
      expect(await actions.removeSection("s1")).toEqual({ deleted: true });
      expect(db.section.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
    });

    it("only hides live sections in the draft (the live page never changes silently)", async () => {
      db.section.findUniqueOrThrow.mockResolvedValue({ id: "s1", publishedData: { text: "x" } });
      expect(await actions.removeSection("s1")).toEqual({ deleted: false });
      expect(db.section.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { visible: false } });
      expect(db.section.delete).not.toHaveBeenCalled();
    });
  });

  it("discardDrafts resets drafts to live and drops never-published sections", async () => {
    db.section.findMany.mockResolvedValue([
      { id: "live", publishedData: { text: "live" }, publishedOrder: 3, publishedVisible: true, order: 0 },
      { id: "new", publishedData: null },
    ]);
    await actions.discardDrafts("p1");
    expect(db.section.update).toHaveBeenCalledWith({ where: { id: "live" }, data: { data: { text: "live" }, order: 3, visible: true } });
    expect(db.section.delete).toHaveBeenCalledWith({ where: { id: "new" } });
  });

  it("addSection rejects unknown types and pre-fills known ones", async () => {
    await expect(actions.addSection("p1", "carousel3d")).rejects.toThrow();
    db.page.findUniqueOrThrow.mockResolvedValue({ id: "p1", sections: [{ order: 0 }, { order: 4 }] });
    await actions.addSection("p1", "services");
    expect(db.section.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pageId: "p1", type: "services", order: 5, data: expect.objectContaining({ items: expect.any(Array) }) }),
    });
  });

  it("updatePageSeo saves trimmed fields and refreshes the page", async () => {
    db.page.update.mockResolvedValueOnce({ slug: "about" } as never);
    await actions.updatePageSeo("p1", { title: " About ", seoTitle: "", seoDescription: " Editor for hire " });
    expect(db.page.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { title: "About", seoTitle: null, seoDescription: "Editor for hire" },
    });
    expect(invalidate.page).toHaveBeenCalledWith("about");
  });
});
