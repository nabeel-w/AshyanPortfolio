import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyPage } from "./aggregate";

const db = vi.hoisted(() => ({
  analyticsDaily: { findMany: vi.fn() },
  analyticsDailyDim: { findMany: vi.fn() },
  analyticsEvent: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  project: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

const { getDashboard, getLive } = await import("./queries");

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const rolled = (day: string, path: string, over: Record<string, unknown> = {}) => ({ id: `${day}${path}`, ...emptyPage(path), day: D(day), ...over });
const raw = (at: string, over: Record<string, unknown> = {}) => ({
  type: "PAGEVIEW",
  visitorHash: "v",
  sessionHash: "s",
  path: "/",
  projectId: null,
  value: null,
  label: null,
  referrer: null,
  source: "DIRECT",
  country: "AE",
  device: "mobile",
  browser: "Safari",
  createdAt: new Date(at),
  ...over,
});

beforeEach(() => {
  db.analyticsDaily.findMany.mockResolvedValue([]);
  db.analyticsDailyDim.findMany.mockResolvedValue([]);
  db.analyticsEvent.findMany.mockResolvedValue([]);
  db.project.findMany.mockResolvedValue([]);
});

describe("getDashboard", () => {
  it("merges rolled-up days with today's raw events", async () => {
    db.analyticsDaily.findMany.mockImplementation(async ({ where }) =>
      where.path === "*"
        ? [rolled("2026-11-01", "*", { visitors: 4, pageviews: 6, leads: 1 })] // previous period
        : [
            rolled("2026-11-09", "*", { visitors: 10, pageviews: 20, videoPlays: 4, avgWatchPct: 50, leads: 1 }),
            rolled("2026-11-09", "/work/a", { projectId: "pa", pageviews: 8, visitors: 6, videoPlays: 4, completions: 1, avgWatchPct: 50, leads: 1 }),
            rolled("2026-11-10", "*", { visitors: 5, pageviews: 5 }),
          ],
    );
    db.analyticsDailyDim.findMany.mockResolvedValue([{ id: "x", day: D("2026-11-09"), dim: "source", key: "AI", visitors: 3, sessions: 3, pageviews: 5, plays: 1, leads: 1, clicks: 0 }]);
    db.analyticsEvent.findMany.mockResolvedValue([
      raw("2026-11-11T08:00:00Z", { source: "AI", referrer: "chatgpt.com" }),
      raw("2026-11-11T08:01:00Z", { type: "VIDEO_PLAY", path: "/work/a", projectId: "pa" }),
      raw("2026-11-11T08:05:00Z", { type: "VIDEO_COMPLETE", path: "/work/a", projectId: "pa", value: 100 }),
    ]);
    db.project.findMany.mockResolvedValue([{ id: "pa", title: "Night Shift", slug: "night-shift" }]);

    const d = await getDashboard("2026-11-09", "2026-11-11", "2026-11-06", "2026-11-08", "2026-11-11");

    // Only today needed raw events (the 9th and 10th are rolled up).
    expect(db.analyticsEvent.findMany.mock.calls[0][0].where.createdAt).toEqual({ gte: D("2026-11-11"), lt: D("2026-11-12") });
    expect(d.series.map((s) => [s.day, s.visitors, s.plays])).toEqual([
      ["2026-11-09", 10, 4],
      ["2026-11-10", 5, 0],
      ["2026-11-11", 1, 1],
    ]);
    expect(d.kpis).toMatchObject({ visitors: 16, pageviews: 26, plays: 5, completions: 1, leads: 1, avgWatchPct: 60 }); // (50·4 + 100·1) / 5
    expect(d.kpis.conversion).toBeCloseTo(1 / 16);
    expect(d.previous).toMatchObject({ visitors: 4, leads: 1 });
    expect(d.dims.source.map((s) => [s.key, s.sessions])).toEqual([
      ["AI", 4],
    ]);
    expect(d.projects).toEqual([expect.objectContaining({ id: "pa", title: "Night Shift", views: 8, plays: 5, completions: 2, completionRate: 0.4, leads: 1 })]);
  });

  it("ignores a stray rollup for today and doesn't query raw events past retention", async () => {
    db.analyticsDaily.findMany.mockImplementation(async ({ where }) => (where.path ? [] : [rolled("2026-11-11", "*", { visitors: 99 })]));
    const d = await getDashboard("2026-05-01", "2026-11-11", "2025-10-26", "2026-04-30", "2026-11-11");
    expect(d.kpis.visitors).toBe(0);
    const ranges = db.analyticsEvent.findMany.mock.calls.map((c) => c[0].where.createdAt.gte.toISOString().slice(0, 10));
    expect(ranges.every((r) => r >= "2026-08-13")).toBe(true);
  });
});

describe("getLive", () => {
  it("counts distinct visitors and page views in the last 30 minutes", async () => {
    db.analyticsEvent.findMany.mockResolvedValue([{ visitorHash: "a" }, { visitorHash: "b" }]);
    db.analyticsEvent.count.mockResolvedValue(7);
    db.analyticsEvent.groupBy.mockResolvedValue([{ path: "/", _count: { _all: 5 } }]);
    const now = new Date("2026-11-11T12:00:00Z");
    expect(await getLive(now)).toEqual({ visitors: 2, pageviews: 7, pages: [{ path: "/", views: 5 }] });
    expect(db.analyticsEvent.count.mock.calls[0][0].where.createdAt.gte).toEqual(new Date("2026-11-11T11:30:00Z"));
  });
});
