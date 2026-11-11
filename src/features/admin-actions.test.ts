import { beforeEach, describe, expect, it, vi } from "vitest";

/** Server actions behind the admin screens (projects, clients, settings) and the public contact form. */

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({ requireAdmin }));

const invalidate = vi.hoisted(() => ({ projects: vi.fn(), clients: vi.fn(), site: vi.fn() }));
vi.mock("@/features/content/invalidate", () => ({ invalidate }));

const headersGet = vi.hoisted(() => vi.fn(() => "http://localhost:3000/contact"));
vi.mock("next/headers", () => ({ headers: async () => ({ get: headersGet }) }));

// after() needs a live request; collect the callbacks and run them by hand.
const afterCallbacks = vi.hoisted(() => [] as (() => unknown)[]);
vi.mock("next/server", () => ({ after: (fn: () => unknown) => afterCallbacks.push(fn) }));
const notifyEnquiry = vi.hoisted(() => vi.fn());
vi.mock("@/features/contact/notify", () => ({ notifyEnquiry }));

const db = vi.hoisted(() => {
  const client = {
    project: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    projectMedia: { deleteMany: vi.fn(), createMany: vi.fn() },
    category: { upsert: vi.fn(async () => ({ id: "cat_1" })) },
    client: { deleteMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    siteSettings: { upsert: vi.fn() },
    contactSubmission: { count: vi.fn(async () => 0), create: vi.fn() },
  };
  return {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => unknown) => fn(client)),
  };
});
vi.mock("@/lib/db", () => ({ db }));

const { saveProject, deleteProject } = await import("./projects/actions");
const { saveClients } = await import("./clients/actions");
const { saveSettings } = await import("./settings/actions");
const { submitContact } = await import("./contact/actions");

beforeEach(() => {
  requireAdmin.mockResolvedValue({ user: { id: "admin" } });
  db.project.findUnique.mockResolvedValue(null);
  db.project.create.mockImplementation(async ({ data }: { data: { slug: string } }) => ({
    id: "p_new",
    ...data,
  }));
  db.project.update.mockImplementation(async ({ data }: { data: { slug: string } }) => ({
    id: "p1",
    ...data,
  }));
});

describe("saveProject", () => {
  it("requires an admin", async () => {
    requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(saveProject(null, { title: "X" })).rejects.toThrow("NEXT_REDIRECT");
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it("generates a clean slug, creates the category and refreshes caches", async () => {
    const res = await saveProject(null, {
      title: "Résonance — Director's Cut",
      category: "Fashion",
    });
    expect(res).toEqual({ ok: true, id: "p_new", slug: "resonance-director-s-cut" });
    expect(db.category.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "fashion" } }),
    );
    expect(invalidate.projects).toHaveBeenCalledWith("resonance-director-s-cut");
  });

  it("rejects a slug already used by another project", async () => {
    db.project.findUnique.mockResolvedValueOnce({ id: "someone_else" });
    const res = await saveProject("p1", { title: "Drive Further" });
    expect(res).toEqual({ ok: false, errors: { slug: expect.stringContaining("already used") } });
  });

  it("won't publish without a cover image", async () => {
    const res = await saveProject(null, { title: "No cover", status: "PUBLISHED" });
    expect(res).toEqual({ ok: false, errors: { coverId: expect.any(String) } });
  });

  it("replaces the gallery in order and drops empty credits", async () => {
    await saveProject("p1", {
      title: "Mumbai",
      coverId: "c1",
      galleryIds: ["g2", "g1"],
      credits: [
        { role: "Director", name: "Ananya" },
        { role: "", name: "" },
      ],
    });
    expect(db.projectMedia.deleteMany).toHaveBeenCalledWith({ where: { projectId: "p1" } });
    expect(db.projectMedia.createMany).toHaveBeenCalledWith({
      data: [
        { projectId: "p1", assetId: "g2", order: 0 },
        { projectId: "p1", assetId: "g1", order: 1 },
      ],
    });
    expect(db.project.update.mock.calls[0]![0].data.credits).toEqual([
      { role: "Director", name: "Ananya" },
    ]);
  });

  it("returns field errors instead of throwing on bad input", async () => {
    const res = await saveProject(null, { title: "", year: 1800 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.errors)).toEqual(expect.arrayContaining(["title", "year"]));
  });

  it("deleteProject refreshes the old project page", async () => {
    db.project.delete.mockResolvedValue({ slug: "gone" });
    await deleteProject("p1");
    expect(invalidate.projects).toHaveBeenCalledWith("gone");
  });
});

describe("saveClients (marquee builder)", () => {
  it("saves in list order, deletes removed rows and returns ids for new rows", async () => {
    db.client.update.mockResolvedValue({ id: "c_keep" });
    db.client.create.mockResolvedValue({ id: "c_new" });
    const ids = await saveClients([
      { name: "Sony", visible: true },
      { id: "c_keep", name: "Nike", url: "https://nike.com", logoId: "logo_1", visible: false },
    ]);
    expect(ids).toEqual(["c_new", "c_keep"]);
    expect(db.client.deleteMany).toHaveBeenCalledWith({ where: { id: { notIn: ["c_keep"] } } });
    expect(db.client.create).toHaveBeenCalledWith({
      data: { name: "Sony", url: null, logoId: null, visible: true, order: 0 },
    });
    expect(db.client.update).toHaveBeenCalledWith({
      where: { id: "c_keep" },
      data: { name: "Nike", url: "https://nike.com", logoId: "logo_1", visible: false, order: 1 },
    });
    expect(invalidate.clients).toHaveBeenCalled();
  });

  it("rejects clients without a name", async () => {
    await expect(saveClients([{ name: "  ", visible: true }])).rejects.toThrow();
  });
});

describe("saveSettings", () => {
  const valid = {
    name: "Ashyan Zafar",
    role: "Film Editor",
    email: "hello@ashyanzafar.com",
    whatsapp: "+91 83349 08607",
    socials: [{ label: "Vimeo", href: "https://vimeo.com/ashyan" }],
  };

  it("saves and refreshes everything tagged 'site'", async () => {
    expect(await saveSettings(valid)).toEqual({ ok: true });
    expect(db.siteSettings.upsert).toHaveBeenCalled();
    expect(invalidate.site).toHaveBeenCalled();
  });

  it("validates the WhatsApp number, email and profile URLs", async () => {
    const res = await saveSettings({
      ...valid,
      whatsapp: "123",
      email: "nope",
      socials: [{ label: "X", href: "x.com" }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok)
      expect(Object.keys(res.errors)).toEqual(
        expect.arrayContaining(["whatsapp", "email", "socials.0.href"]),
      );
    expect(db.siteSettings.upsert).not.toHaveBeenCalled();
  });

  it("an empty WhatsApp number hides the button (stored as null)", async () => {
    await saveSettings({ ...valid, whatsapp: "" });
    expect(db.siteSettings.upsert.mock.calls[0]![0].update.whatsapp).toBeNull();
  });
});

describe("submitContact (public form)", () => {
  const form = (fields: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  };
  const ok = {
    name: "Sara",
    email: "sara@studio.com",
    message: "We need an editor for a 60s spot.",
  };

  it("stores a valid enquiry with the page it came from", async () => {
    expect(
      await submitContact({ status: "idle" }, form({ ...ok, projectType: "Commercial" })),
    ).toEqual({ status: "success" });
    expect(db.contactSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Sara",
        email: "sara@studio.com",
        budget: "Commercial",
        source: "/contact",
      }),
    });
  });

  it("emails the enquiry after responding, so the visitor never waits on Gmail (#13)", async () => {
    afterCallbacks.length = 0;
    await submitContact({ status: "idle" }, form({ ...ok, company: "Studio" }));
    expect(notifyEnquiry).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]!();
    expect(notifyEnquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Sara",
        email: "sara@studio.com",
        company: "Studio",
        source: "/contact",
      }),
    );
  });

  it("doesn't email bot or invalid submissions", async () => {
    afterCallbacks.length = 0;
    await submitContact({ status: "idle" }, form({ ...ok, website: "spam.example" }));
    await submitContact({ status: "idle" }, form({ name: "S", email: "bad", message: "short" }));
    expect(afterCallbacks).toHaveLength(0);
  });

  it("returns per-field errors", async () => {
    const res = await submitContact(
      { status: "idle" },
      form({ name: "S", email: "bad", message: "short" }),
    );
    expect(res).toMatchObject({
      status: "error",
      fieldErrors: {
        name: expect.any(String),
        email: expect.any(String),
        message: expect.any(String),
      },
    });
    expect(db.contactSubmission.create).not.toHaveBeenCalled();
  });

  it("silently swallows bot submissions (honeypot filled)", async () => {
    expect(
      await submitContact({ status: "idle" }, form({ ...ok, website: "spam.example" })),
    ).toEqual({ status: "success" });
    expect(db.contactSubmission.create).not.toHaveBeenCalled();
  });

  it("rate-limits repeated messages from the same email", async () => {
    db.contactSubmission.count.mockResolvedValueOnce(3);
    expect(await submitContact({ status: "idle" }, form(ok))).toMatchObject({ status: "error" });
    expect(db.contactSubmission.create).not.toHaveBeenCalled();
  });
});
