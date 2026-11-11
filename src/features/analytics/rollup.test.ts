import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  analyticsEvent: { findMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
  analyticsDaily: { findFirst: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  analyticsDailyDim: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db }));

const { runRollups, rollupDay, utcDay } = await import("./rollup");

const now = new Date("2026-11-11T00:15:00Z");
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const rolledDays = () => db.analyticsDaily.deleteMany.mock.calls.map((c) => (c[0].where.day as Date).toISOString().slice(0, 10));

beforeEach(() => {
  db.analyticsEvent.findMany.mockResolvedValue([]);
  db.analyticsEvent.findFirst.mockResolvedValue(null);
  db.analyticsEvent.deleteMany.mockResolvedValue({ count: 0 });
  db.analyticsDaily.findFirst.mockResolvedValue(null);
  db.$transaction.mockResolvedValue([]);
});

describe("rollupDay", () => {
  it("replaces one UTC day's rows from that day's raw events", async () => {
    db.analyticsEvent.findMany.mockResolvedValue([
      { type: "PAGEVIEW", visitorHash: "v", sessionHash: "s", path: "/", projectId: null, value: null, label: null, referrer: null, source: "DIRECT", country: null, device: "desktop", browser: "Chrome", createdAt: now },
    ]);
    const res = await rollupDay(new Date("2026-11-10T17:30:00Z"));
    expect(res).toEqual({ day: "2026-11-10", pages: 2, dims: 4 });
    expect(db.analyticsEvent.findMany.mock.calls[0][0].where.createdAt).toEqual({ gte: day("2026-11-10"), lt: day("2026-11-11") });
    const pages = db.analyticsDaily.createMany.mock.calls[0][0].data;
    expect(pages.every((p: { day: Date }) => p.day.getTime() === day("2026-11-10").getTime())).toBe(true);
  });
});

describe("runRollups", () => {
  it("rolls up from the oldest raw event to yesterday when nothing is rolled yet", async () => {
    db.analyticsEvent.findFirst.mockResolvedValue({ createdAt: new Date("2026-11-08T09:00:00Z") });
    const res = await runRollups(now);
    expect(rolledDays()).toEqual(["2026-11-08", "2026-11-09", "2026-11-10"]);
    expect(res.days).toHaveLength(3);
  });

  it("continues after the latest rollup and always redoes yesterday", async () => {
    db.analyticsDaily.findFirst.mockResolvedValue({ day: day("2026-11-10") });
    await runRollups(now);
    expect(rolledDays()).toEqual(["2026-11-10"]);
  });

  it("never rolls up days past retention, and prunes raw events older than 90 days", async () => {
    db.analyticsEvent.deleteMany.mockResolvedValue({ count: 7 });
    const res = await runRollups(now, { from: day("2025-01-01"), to: day("2026-08-14") });
    expect(rolledDays()[0]).toBe("2026-08-13");
    expect(res.pruned).toBe(7);
    expect(db.analyticsEvent.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: day("2026-08-13") } } });
  });

  it("utcDay truncates to midnight UTC", () => {
    expect(utcDay(new Date("2026-11-10T23:59:59Z")).toISOString()).toBe("2026-11-10T00:00:00.000Z");
  });
});

describe("GET /api/cron/analytics", () => {
  it("is closed without the secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.resetModules();
    const { GET: closed } = await import("@/app/api/cron/analytics/route");
    expect((await closed(new Request("http://localhost/x", { headers: { authorization: "Bearer " } }))).status).toBe(401);
  });

  it("rejects a wrong token and runs with the right one", async () => {
    vi.stubEnv("CRON_SECRET", "s".repeat(32));
    vi.resetModules();
    const { GET: open } = await import("@/app/api/cron/analytics/route");
    expect((await open(new Request("http://localhost/x", { headers: { authorization: "Bearer nope" } }))).status).toBe(401);
    const ok = await open(new Request("http://localhost/x", { headers: { authorization: `Bearer ${"s".repeat(32)}` } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true });
  });
});
