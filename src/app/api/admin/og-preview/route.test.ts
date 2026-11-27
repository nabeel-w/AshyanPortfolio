import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
const shareCardFor = vi.hoisted(() => vi.fn());
vi.mock("@/features/seo/share-server", () => ({ shareCardFor }));
const renderShareCard = vi.hoisted(() => vi.fn(async () => Buffer.from([0xff, 0xd8, 0xff])));
vi.mock("@/features/seo/og-template", () => ({ renderShareCard }));
vi.mock("@/features/seo/og-card", () => ({ OG_CONTENT_TYPE: "image/jpeg" }));

const { POST } = await import("./route");

const req = (body: unknown) =>
  new Request("http://localhost/api/admin/og-preview", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  getSession.mockResolvedValue({ user: { role: "ADMIN" } });
  shareCardFor.mockResolvedValue({ input: { template: "still" }, version: "abc", alt: "", url: "/og/page/home?v=abc" });
});

describe("POST /api/admin/og-preview (#33)", () => {
  it("is admin only, and never cached or indexed", async () => {
    getSession.mockResolvedValue(null);
    const res = await POST(req({ target: { kind: "page", slug: "home" } }));
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    getSession.mockResolvedValue({ user: { role: "EDITOR" } });
    expect((await POST(req({ target: { kind: "page", slug: "home" } }))).status).toBe(401);
    expect(renderShareCard).not.toHaveBeenCalled();
  });

  it("renders the draft with the preview font path and returns a no-store, noindex JPEG", async () => {
    const res = await POST(req({ target: { kind: "page", slug: "about" }, settings: { headline: "Hi *there*" }, override: { headline: "About" } }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(shareCardFor).toHaveBeenCalledWith(
      { kind: "page", slug: "about" },
      { settings: expect.objectContaining({ headline: "Hi *there*" }), override: expect.objectContaining({ headline: "About" }) },
    );
    expect(renderShareCard).toHaveBeenCalledWith({ template: "still" }, { preview: true });
  });

  it("rejects bad input and unknown targets", async () => {
    expect((await POST(req({ target: { kind: "page", slug: "../etc" } }))).status).toBe(400);
    expect((await POST(req({ target: { kind: "page", slug: "home" }, settings: { overlay: 900 } }))).status).toBe(400);
    shareCardFor.mockResolvedValue(null);
    expect((await POST(req({ target: { kind: "page", slug: "press" } }))).status).toBe(404);
  });
});
