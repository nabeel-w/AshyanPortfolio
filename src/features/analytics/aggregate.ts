/**
 * Pure aggregation of raw events into daily rows (one per path plus "*" for the whole site, and
 * one per dimension key). The nightly rollup stores these; the dashboard runs the same function
 * over today's raw events, so live and rolled-up numbers always mean the same thing.
 */

export type RawEvent = {
  type: string;
  visitorHash: string;
  sessionHash: string;
  path: string;
  projectId: string | null;
  value: number | null;
  label: string | null;
  referrer: string | null;
  source: string;
  country: string | null;
  device: string | null;
  browser: string | null;
};

export type PageRow = {
  path: string;
  projectId: string | null;
  pageviews: number;
  visitors: number;
  sessions: number;
  videoPlays: number;
  progress25: number;
  progress50: number;
  progress75: number;
  completions: number;
  avgWatchPct: number | null;
  ctaClicks: number;
  leads: number;
};

export const DIMS = ["source", "referrer", "device", "country", "browser", "cta", "outbound"] as const;
export type Dim = (typeof DIMS)[number];

export type DimRow = {
  dim: Dim;
  key: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  plays: number;
  leads: number;
  clicks: number;
};

export const SITE = "*";

type PageAcc = {
  projectId: string | null;
  pageviews: number;
  visitors: Set<string>;
  sessions: Set<string>;
  plays: number;
  p25: number;
  p50: number;
  p75: number;
  completions: number;
  watch: Map<string, number>;
  cta: number;
  leads: number;
};

type DimAcc = { visitors: Set<string>; sessions: Set<string>; pageviews: number; plays: number; leads: number; clicks: number };

const pageAcc = (): PageAcc => ({
  projectId: null,
  pageviews: 0,
  visitors: new Set(),
  sessions: new Set(),
  plays: 0,
  p25: 0,
  p50: 0,
  p75: 0,
  completions: 0,
  watch: new Map(),
  cta: 0,
  leads: 0,
});
const dimAcc = (): DimAcc => ({ visitors: new Set(), sessions: new Set(), pageviews: 0, plays: 0, leads: 0, clicks: 0 });

/** Events must be in chronological order (a session's first event decides its attributes). */
export function aggregate(events: RawEvent[]): { pages: PageRow[]; dims: DimRow[] } {
  const pages = new Map<string, PageAcc>();
  const dims = new Map<string, DimAcc>();
  const sessionAttrs = new Map<string, Pick<RawEvent, "source" | "referrer" | "device" | "country" | "browser">>();
  const leadSessions = new Set<string>();

  const page = (path: string) => {
    let acc = pages.get(path);
    if (!acc) pages.set(path, (acc = pageAcc()));
    return acc;
  };
  const dim = (d: Dim, key: string) => {
    const k = `${d}\u0000${key}`;
    let acc = dims.get(k);
    if (!acc) dims.set(k, (acc = dimAcc()));
    return acc;
  };

  for (const e of events) {
    if (!sessionAttrs.has(e.sessionHash)) sessionAttrs.set(e.sessionHash, e);
    if (e.type === "CONTACT_SUBMIT") leadSessions.add(e.sessionHash);
  }

  for (const e of events) {
    const targets = [page(SITE), page(e.path)];
    const p = targets[1];
    if (e.projectId) p.projectId = e.projectId;
    const watchKey = `${e.sessionHash}\u0000${e.path}`;

    // Site-wide visitors/sessions count anyone with any event; per-path ones count page viewers.
    targets[0].visitors.add(e.visitorHash);
    targets[0].sessions.add(e.sessionHash);

    for (const t of targets) {
      switch (e.type) {
        case "PAGEVIEW":
          t.pageviews += 1;
          if (t === p) {
            p.visitors.add(e.visitorHash);
            p.sessions.add(e.sessionHash);
          }
          break;
        case "VIDEO_PLAY":
          t.plays += 1;
          t.watch.set(watchKey, Math.max(t.watch.get(watchKey) ?? 0, 0));
          break;
        case "VIDEO_PROGRESS":
          if (e.value === 25) t.p25 += 1;
          else if (e.value === 50) t.p50 += 1;
          else if (e.value === 75) t.p75 += 1;
          if (e.value) t.watch.set(watchKey, Math.max(t.watch.get(watchKey) ?? 0, e.value));
          break;
        case "VIDEO_COMPLETE":
          t.completions += 1;
          t.watch.set(watchKey, 100);
          break;
        case "CTA_CLICK":
          t.cta += 1;
          break;
        case "CONTACT_SUBMIT":
          if (t !== p) t.leads += 1;
          break;
      }
    }

    // Dimensions follow the session's landing attributes.
    const s = sessionAttrs.get(e.sessionHash)!;
    const keys: [Dim, string | null][] = [
      ["source", s.source],
      ["referrer", s.referrer],
      ["device", s.device ?? "unknown"],
      ["country", s.country ?? "unknown"],
      ["browser", s.browser ?? "unknown"],
    ];
    for (const [d, key] of keys) {
      if (!key) continue;
      const acc = dim(d, key);
      acc.visitors.add(e.visitorHash);
      acc.sessions.add(e.sessionHash);
      if (e.type === "PAGEVIEW") acc.pageviews += 1;
      if (e.type === "VIDEO_PLAY") acc.plays += 1;
      if (e.type === "CONTACT_SUBMIT") acc.leads += 1;
    }
    if ((e.type === "CTA_CLICK" || e.type === "OUTBOUND_CLICK") && e.label) {
      const acc = dim(e.type === "CTA_CLICK" ? "cta" : "outbound", e.label);
      acc.visitors.add(e.visitorHash);
      acc.sessions.add(e.sessionHash);
      acc.clicks += 1;
    }
  }

  // A path's leads are the sessions that viewed it and enquired (any time that day).
  for (const [path, acc] of pages) {
    if (path === SITE) continue;
    for (const s of acc.sessions) if (leadSessions.has(s)) acc.leads += 1;
  }

  const pageRows: PageRow[] = [];
  for (const [path, a] of pages) {
    if (path !== SITE && a.pageviews + a.plays + a.cta === 0) continue;
    const watched = [...a.watch.values()];
    pageRows.push({
      path,
      projectId: path === SITE ? null : a.projectId,
      pageviews: a.pageviews,
      visitors: a.visitors.size,
      sessions: a.sessions.size,
      videoPlays: a.plays,
      progress25: a.p25,
      progress50: a.p50,
      progress75: a.p75,
      completions: a.completions,
      avgWatchPct: watched.length ? Math.round((watched.reduce((x, y) => x + y, 0) / watched.length) * 10) / 10 : null,
      ctaClicks: a.cta,
      leads: a.leads,
    });
  }
  if (!pages.size) pageRows.push({ ...emptyPage(SITE) });

  const dimRows: DimRow[] = [...dims].map(([k, a]) => {
    const [d, key] = k.split("\u0000") as [Dim, string];
    return { dim: d, key, visitors: a.visitors.size, sessions: a.sessions.size, pageviews: a.pageviews, plays: a.plays, leads: a.leads, clicks: a.clicks };
  });

  return { pages: pageRows, dims: dimRows };
}

export function emptyPage(path: string): PageRow {
  return {
    path,
    projectId: null,
    pageviews: 0,
    visitors: 0,
    sessions: 0,
    videoPlays: 0,
    progress25: 0,
    progress50: 0,
    progress75: 0,
    completions: 0,
    avgWatchPct: null,
    ctaClicks: 0,
    leads: 0,
  };
}
