import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  analyticsEvent: { findFirst: vi.fn(), create: vi.fn() },
  project: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

const { recordEvent, visitorHash, projectSlug, clientEventSchema } = await import("./ingest");
const { POST } = await import("@/app/api/analytics/route");

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
let ipCounter = 0;
const headers = (extra: Record<string, string> = {}) =>
  new Headers({ "user-agent": UA, "x-forwarded-for": `203.0.113.${++ipCounter}, 10.0.0.1`, host: "localhost:3000", ...extra });
const now = new Date("2026-11-11T12:00:00Z");

beforeEach(() => {
  db.analyticsEvent.findFirst.mockResolvedValue(null);
  db.analyticsEvent.create.mockResolvedValue({});
  db.project.findUnique.mockResolvedValue(null);
});

describe("recordEvent", () => {
  it("stores a landing with source, referrer host, utm and device — never the IP", async () => {
    const h = headers({ "x-vercel-ip-country": "ae" });
    const res = await recordEvent({ type: "PAGEVIEW", path: "/?x=1", referrer: "https://www.perplexity.ai/search", search: "?utm_campaign=launch" }, h, now);
    expect(res).toEqual({ stored: true });
    const data = db.analyticsEvent.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ type: "PAGEVIEW", path: "/", source: "AI", referrer: "perplexity.ai", utmCampaign: "launch", country: "AE", device: "mobile", browser: "Safari" });
    expect(JSON.stringify(data)).not.toContain("203.0.113");
  });

  it("drops bots and signed-in admins without touching the DB", async () => {
    expect(await recordEvent({ type: "PAGEVIEW", path: "/" }, headers({ "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" }), now)).toEqual({ stored: false, reason: "bot" });
    expect(await recordEvent({ type: "PAGEVIEW", path: "/" }, headers({ cookie: "better-auth.session_token=abc" }), now)).toEqual({ stored: false, reason: "admin" });
    expect(db.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it("continues a session on internal navigation and keeps its original source", async () => {
    db.analyticsEvent.findFirst.mockResolvedValue({ sessionHash: "sess1", source: "AI", referrer: "chatgpt.com", utmSource: "chatgpt.com", utmMedium: null, utmCampaign: null });
    await recordEvent({ type: "PAGEVIEW", path: "/work", referrer: "http://localhost:3000/" }, headers(), now);
    expect(db.analyticsEvent.create.mock.calls[0][0].data).toMatchObject({ sessionHash: "sess1", source: "AI", referrer: "chatgpt.com", utmSource: "chatgpt.com" });
  });

  it("starts a new session when a new external referrer arrives", async () => {
    db.analyticsEvent.findFirst.mockResolvedValue({ sessionHash: "sess1", source: "AI", referrer: "chatgpt.com", utmSource: null, utmMedium: null, utmCampaign: null });
    await recordEvent({ type: "PAGEVIEW", path: "/", referrer: "https://www.google.com/" }, headers(), now);
    const data = db.analyticsEvent.create.mock.calls[0][0].data;
    expect(data.sessionHash).not.toBe("sess1");
    expect(data.source).toBe("SEARCH");
  });

  it("resolves the project id for /work/<slug> paths", async () => {
    db.project.findUnique.mockResolvedValue({ id: "proj_1" });
    await recordEvent({ type: "VIDEO_PROGRESS", path: "/work/night-shift", value: 50 }, headers(), now);
    expect(db.project.findUnique).toHaveBeenCalledWith({ where: { slug: "night-shift" }, select: { id: true } });
    expect(db.analyticsEvent.create.mock.calls[0][0].data).toMatchObject({ projectId: "proj_1", value: 50 });
  });

  it("rate-limits a runaway visitor", async () => {
    const h = headers();
    let last;
    for (let i = 0; i < 121; i++) last = await recordEvent({ type: "PAGEVIEW", path: "/" }, h, now);
    expect(last).toEqual({ stored: false, reason: "rate-limited" });
  });
});

describe("helpers", () => {
  it("rotates the visitor hash daily", () => {
    const a = visitorHash("1.2.3.4", UA, now);
    expect(visitorHash("1.2.3.4", UA, new Date("2026-11-11T23:59:00Z"))).toBe(a);
    expect(visitorHash("1.2.3.4", UA, new Date("2026-11-12T00:00:01Z"))).not.toBe(a);
    expect(visitorHash("1.2.3.5", UA, now)).not.toBe(a);
  });

  it("parses project slugs", () => {
    expect(projectSlug("/work/night-shift")).toBe("night-shift");
    expect(projectSlug("/work")).toBeNull();
    expect(projectSlug("/work/a/b")).toBeNull();
  });

  it("refuses CONTACT_SUBMIT from the browser", () => {
    expect(clientEventSchema.safeParse({ t: "CONTACT_SUBMIT", p: "/" }).success).toBe(false);
    expect(clientEventSchema.safeParse({ t: "PAGEVIEW", p: "https://evil" }).success).toBe(false);
  });
});

describe("POST /api/analytics", () => {
  const req = (body: string, h: Record<string, string> = {}) =>
    new Request("http://localhost:3000/api/analytics", { method: "POST", body, headers: { "user-agent": UA, "sec-fetch-site": "same-origin", ...h } });

  it("accepts a valid beacon with 204", async () => {
    const res = await POST(req(JSON.stringify({ t: "PAGEVIEW", p: "/" })));
    expect(res.status).toBe(204);
    expect(db.analyticsEvent.create).toHaveBeenCalledOnce();
  });

  it("rejects cross-site, malformed and oversized bodies", async () => {
    expect((await POST(req(JSON.stringify({ t: "PAGEVIEW", p: "/" }), { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await POST(req("{nope"))).status).toBe(400);
    expect((await POST(req(JSON.stringify({ t: "NOPE", p: "/" })))).status).toBe(400);
    expect((await POST(req("x".repeat(3000)))).status).toBe(413);
    expect(db.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it("still answers 204 when the DB write fails", async () => {
    db.analyticsEvent.create.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await POST(req(JSON.stringify({ t: "PAGEVIEW", p: "/" })))).status).toBe(204);
  });
});
