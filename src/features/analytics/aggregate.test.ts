import { describe, expect, it } from "vitest";
import { aggregate, SITE, type RawEvent } from "./aggregate";

const ev = (over: Partial<RawEvent>): RawEvent => ({
  type: "PAGEVIEW",
  visitorHash: "v1",
  sessionHash: "s1",
  path: "/",
  projectId: null,
  value: null,
  label: null,
  referrer: null,
  source: "DIRECT",
  country: "AE",
  device: "mobile",
  browser: "Safari",
  ...over,
});

// v1/s1 lands from ChatGPT, watches a film to 75% and enquires. v2/s2 is direct, plays and completes.
const events: RawEvent[] = [
  ev({ source: "AI", referrer: "chatgpt.com" }),
  ev({ path: "/work/a", projectId: "pa", referrer: null, source: "AI" }),
  ev({ type: "VIDEO_PLAY", path: "/work/a", projectId: "pa" }),
  ev({ type: "VIDEO_PROGRESS", path: "/work/a", projectId: "pa", value: 25 }),
  ev({ type: "VIDEO_PROGRESS", path: "/work/a", projectId: "pa", value: 50 }),
  ev({ type: "VIDEO_PROGRESS", path: "/work/a", projectId: "pa", value: 75 }),
  ev({ type: "CTA_CLICK", path: "/work/a", label: "email" }),
  ev({ type: "CONTACT_SUBMIT", path: "/contact" }),
  ev({ visitorHash: "v2", sessionHash: "s2", path: "/work/a", projectId: "pa", device: "desktop", country: null, browser: "Chrome" }),
  ev({ visitorHash: "v2", sessionHash: "s2", type: "VIDEO_PLAY", path: "/work/a", projectId: "pa" }),
  ev({ visitorHash: "v2", sessionHash: "s2", type: "VIDEO_COMPLETE", path: "/work/a", projectId: "pa", value: 100 }),
  ev({ visitorHash: "v2", sessionHash: "s2", type: "OUTBOUND_CLICK", path: "/work/a", label: "vimeo.com" }),
];

describe("aggregate", () => {
  const { pages, dims } = aggregate(events);
  const page = (p: string) => pages.find((r) => r.path === p)!;
  const dim = (d: string, k: string) => dims.find((r) => r.dim === d && r.key === k);

  it("totals the whole site in the * row", () => {
    expect(page(SITE)).toMatchObject({
      pageviews: 3,
      visitors: 2,
      sessions: 2,
      videoPlays: 2,
      progress25: 1,
      progress50: 1,
      progress75: 1,
      completions: 1,
      ctaClicks: 1,
      leads: 1,
      avgWatchPct: 87.5, // (75 + 100) / 2
      projectId: null,
    });
  });

  it("builds per-path rows with project ids and attributed leads", () => {
    expect(page("/work/a")).toMatchObject({ projectId: "pa", pageviews: 2, visitors: 2, sessions: 2, videoPlays: 2, completions: 1, leads: 1, avgWatchPct: 87.5 });
    expect(page("/")).toMatchObject({ pageviews: 1, leads: 1 });
    // /contact only has a CONTACT_SUBMIT (no pageview/play/cta), so it gets no row.
    expect(pages.find((r) => r.path === "/contact")).toBeUndefined();
  });

  it("breaks sessions down by their landing attributes", () => {
    expect(dim("source", "AI")).toMatchObject({ visitors: 1, sessions: 1, pageviews: 2, plays: 1, leads: 1 });
    expect(dim("source", "DIRECT")).toMatchObject({ visitors: 1, pageviews: 1, plays: 1, leads: 0 });
    expect(dim("referrer", "chatgpt.com")).toMatchObject({ sessions: 1 });
    expect(dim("device", "desktop")).toMatchObject({ visitors: 1 });
    expect(dim("country", "unknown")).toMatchObject({ visitors: 1 });
    expect(dim("browser", "Chrome")).toMatchObject({ visitors: 1 });
    expect(dim("cta", "email")).toMatchObject({ clicks: 1 });
    expect(dim("outbound", "vimeo.com")).toMatchObject({ clicks: 1 });
    expect(dims.filter((d) => d.dim === "referrer")).toHaveLength(1); // direct has no referrer row
  });

  it("returns an empty * row for a day without events", () => {
    const res = aggregate([]);
    expect(res.pages).toEqual([expect.objectContaining({ path: SITE, pageviews: 0, avgWatchPct: null })]);
    expect(res.dims).toEqual([]);
  });
});
