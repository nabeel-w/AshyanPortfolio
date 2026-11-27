import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({ requireAdmin }));
const invalidate = vi.hoisted(() => ({ labels: vi.fn(), projects: vi.fn() }));
vi.mock("@/features/content/invalidate", () => ({ invalidate }));

type Label = { id: string; name: string; slug: string; previousSlugs: string[]; visible: boolean; order: number };
const store = vi.hoisted(() => ({ labels: new Map<string, Label>(), links: [] as { projectId: string; labelId: string; order: number }[] }));

const db = vi.hoisted(() => {
  const withCount = (l: Label) => ({
    ...l,
    description: null,
    seoTitle: null,
    seoDescription: null,
    _count: { projects: store.links.filter((x) => x.labelId === l.id).length },
    projects: store.links.filter((x) => x.labelId === l.id),
  });
  const label = {
    findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
      const l = store.labels.get(where.id);
      if (!l) throw new Error("not found");
      return withCount(l);
    }),
    findFirst: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
      const all = [...store.labels.values()];
      if (!where) return all.sort((a, b) => b.order - a.order)[0] ?? null;
      const or = (where.OR as Record<string, unknown>[] | undefined) ?? [where];
      const not = (where.NOT as { id?: string } | undefined)?.id;
      return (
        all.find(
          (l) =>
            l.id !== not &&
            or.some((c) =>
              (c.slug !== undefined && l.slug === c.slug) ||
              ((c.previousSlugs as { has?: string })?.has !== undefined && l.previousSlugs.includes((c.previousSlugs as { has: string }).has)) ||
              ((c.name as { equals?: string })?.equals !== undefined && l.name.toLowerCase() === (c.name as { equals: string }).equals.toLowerCase()),
            ),
        ) ?? null
      );
    }),
    create: vi.fn(async ({ data }: { data: Omit<Label, "id" | "previousSlugs" | "visible"> }) => {
      const l = { id: `l${store.labels.size + 1}`, previousSlugs: [], visible: true, ...data };
      store.labels.set(l.id, l);
      return l;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Label> }) => {
      const l = { ...store.labels.get(where.id)!, ...data };
      store.labels.set(l.id, l);
      return l;
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      store.labels.delete(where.id);
      store.links = store.links.filter((x) => x.labelId !== where.id);
    }),
  };
  const projectLabel = { create: vi.fn(async ({ data }: { data: (typeof store.links)[number] }) => store.links.push(data)) };
  const client = { label, projectLabel };
  return { ...client, $transaction: vi.fn(async (fn: unknown) => (typeof fn === "function" ? fn(client) : Promise.all(fn as Promise<unknown>[]))) };
});
vi.mock("@/lib/db", () => ({ db }));

const { createLabel, deleteLabel, mergeLabel, reorderLabels, updateLabel } = await import("./actions");

const seed = (l: Partial<Label> & { id: string; name: string; slug: string }) =>
  store.labels.set(l.id, { previousSlugs: [], visible: true, order: store.labels.size, ...l });

beforeEach(() => {
  store.labels.clear();
  store.links = [];
  requireAdmin.mockResolvedValue({ user: { id: "admin" } });
});

describe("label actions (#28)", () => {
  it("every action requires an admin", async () => {
    requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(createLabel("Reels")).rejects.toThrow("NEXT_REDIRECT");
    await expect(updateLabel("l1", { name: "x" })).rejects.toThrow("NEXT_REDIRECT");
    await expect(reorderLabels(["l1"])).rejects.toThrow("NEXT_REDIRECT");
    await expect(mergeLabel("l1", "l2")).rejects.toThrow("NEXT_REDIRECT");
    await expect(deleteLabel("l1")).rejects.toThrow("NEXT_REDIRECT");
    expect(db.label.create).not.toHaveBeenCalled();
  });

  it("creates a label with a clean slug, reusing an existing one by name", async () => {
    const res = await createLabel("  Music Video ");
    expect(res).toMatchObject({ ok: true, label: { name: "Music Video", slug: "music-video" } });
    expect(await createLabel("music video")).toMatchObject({ ok: true, label: { id: res.ok ? res.label.id : "" } });
    expect(store.labels.size).toBe(1);
    expect(invalidate.labels).toHaveBeenCalledWith("music-video");
    expect(await createLabel("")).toMatchObject({ ok: false });
  });

  it("renames without touching the slug unless asked; re-slugging keeps the old slug as a redirect", async () => {
    seed({ id: "l1", name: "Fashion", slug: "fashion" });
    await updateLabel("l1", { name: "Fashion films" });
    expect(store.labels.get("l1")).toMatchObject({ name: "Fashion films", slug: "fashion", previousSlugs: [] });
    await updateLabel("l1", { reslug: true });
    expect(store.labels.get("l1")).toMatchObject({ slug: "fashion-films", previousSlugs: ["fashion"] });
    expect(invalidate.labels).toHaveBeenLastCalledWith("fashion", "fashion-films");
  });

  it("merges: projects move over (no duplicates), the source's slugs redirect, the source is gone", async () => {
    seed({ id: "l1", name: "Fashion", slug: "fashion", previousSlugs: ["mode"] });
    seed({ id: "l2", name: "Fashion films", slug: "fashion-films" });
    store.links.push({ projectId: "p1", labelId: "l1", order: 0 }, { projectId: "p2", labelId: "l1", order: 1 }, { projectId: "p2", labelId: "l2", order: 0 });
    const res = await mergeLabel("l1", "l2");
    expect(res.ok).toBe(true);
    expect(store.labels.has("l1")).toBe(false);
    expect(store.links.filter((x) => x.labelId === "l2").map((x) => x.projectId).sort()).toEqual(["p1", "p2"]);
    expect(store.labels.get("l2")!.previousSlugs.sort()).toEqual(["fashion", "mode"]);
    expect(await mergeLabel("l2", "l2")).toMatchObject({ ok: false });
  });

  it("refuses to delete a label that projects use, unless told to remove it from them", async () => {
    seed({ id: "l1", name: "Reels", slug: "reels" });
    store.links.push({ projectId: "p1", labelId: "l1", order: 0 });
    expect(await deleteLabel("l1")).toMatchObject({ ok: false, error: expect.stringContaining("1 project") });
    expect(store.labels.has("l1")).toBe(true);
    expect(await deleteLabel("l1", { removeFromProjects: true })).toEqual({ ok: true });
    expect(store.labels.has("l1")).toBe(false);
  });

  it("saves the order as given", async () => {
    seed({ id: "l1", name: "A", slug: "a" });
    seed({ id: "l2", name: "B", slug: "b" });
    await reorderLabels(["l2", "l1"]);
    expect(store.labels.get("l2")!.order).toBe(0);
    expect(store.labels.get("l1")!.order).toBe(1);
  });
});
