import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { aggregate, SITE, type DimRow, type PageRow } from "./aggregate";
import { eachDay } from "./range";
import { RETENTION_DAYS, rawSelect } from "./rollup";

export const ANALYTICS_TAG = "analytics";

export type Kpis = {
  visitors: number;
  sessions: number;
  pageviews: number;
  plays: number;
  progress25: number;
  progress50: number;
  progress75: number;
  completions: number;
  avgWatchPct: number | null;
  ctaClicks: number;
  leads: number;
  /** leads / visitors */
  conversion: number | null;
};

export type DayPoint = { day: string; visitors: number; pageviews: number; plays: number; leads: number; avgWatchPct: number | null; conversion: number | null };
export type DimStat = Omit<DimRow, "dim">;
export type ProjectStat = { id: string; title: string; slug: string; views: number; visitors: number; plays: number; completions: number; completionRate: number | null; avgWatchPct: number | null; leads: number };
export type PageStat = { path: string; pageviews: number; visitors: number; leads: number };

export type Dashboard = {
  kpis: Kpis;
  previous: Kpis;
  series: DayPoint[];
  dims: Record<"source" | "referrer" | "device" | "country" | "browser" | "cta" | "outbound", DimStat[]>;
  projects: ProjectStat[];
  pages: PageStat[];
};

type DayRows = { pages: (PageRow & { day: string })[]; dims: (DimRow & { day: string })[] };

const DAY = 86_400_000;
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + DAY);
const dayStr = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Rows for [from, to]: stored rollups where they exist, and the same aggregation run live over raw
 * events for days without one (today, or before the cron has run). Days past retention without a
 * rollup are simply empty.
 */
async function loadDays(from: string, to: string, today: string, siteOnly: boolean): Promise<DayRows> {
  const where = { day: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) }, ...(siteOnly ? { path: SITE } : {}) };
  const [rolled, rolledDims] = await Promise.all([
    db.analyticsDaily.findMany({ where }),
    siteOnly ? Promise.resolve([]) : db.analyticsDailyDim.findMany({ where: { day: where.day } }),
  ]);

  const pages: DayRows["pages"] = [];
  const dims: DayRows["dims"] = [];
  const rolledDays = new Set<string>();
  for (const r of rolled) {
    const day = dayStr(r.day);
    if (day === today) continue; // a manual re-run could have rolled up a partial today
    if (r.path === SITE) rolledDays.add(day);
    pages.push({ ...r, day });
  }
  for (const r of rolledDims) {
    const day = dayStr(r.day);
    if (rolledDays.has(day)) dims.push({ ...r, dim: r.dim as DimRow["dim"], day });
  }

  const floor = dayStr(new Date(Date.parse(`${today}T00:00:00Z`) - RETENTION_DAYS * DAY));
  const missing = eachDay(from, to).filter((d) => !rolledDays.has(d) && d >= floor);
  if (missing.length) {
    const raw = await db.analyticsEvent.findMany({
      where: { createdAt: { gte: new Date(`${missing[0]}T00:00:00Z`), lt: nextDay(missing.at(-1)!) } },
      orderBy: { createdAt: "asc" },
      select: rawSelect,
    });
    const byDay = new Map<string, typeof raw>();
    for (const e of raw) {
      const d = dayStr(e.createdAt);
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d)!.push(e);
    }
    for (const day of missing) {
      const agg = aggregate(byDay.get(day) ?? []);
      for (const p of agg.pages) if (!siteOnly || p.path === SITE) pages.push({ ...p, day });
      if (!siteOnly) for (const d of agg.dims) dims.push({ ...d, day });
    }
  }
  return { pages, dims };
}

function sumKpis(rows: PageRow[]): Kpis {
  const k = rows.reduce(
    (a, r) => {
      a.visitors += r.visitors;
      a.sessions += r.sessions;
      a.pageviews += r.pageviews;
      a.plays += r.videoPlays;
      a.progress25 += r.progress25;
      a.progress50 += r.progress50;
      a.progress75 += r.progress75;
      a.completions += r.completions;
      a.ctaClicks += r.ctaClicks;
      a.leads += r.leads;
      if (r.avgWatchPct !== null && r.videoPlays) {
        a.watchSum += r.avgWatchPct * r.videoPlays;
        a.watchWeight += r.videoPlays;
      }
      return a;
    },
    { visitors: 0, sessions: 0, pageviews: 0, plays: 0, progress25: 0, progress50: 0, progress75: 0, completions: 0, ctaClicks: 0, leads: 0, watchSum: 0, watchWeight: 0 },
  );
  const { watchSum, watchWeight, ...rest } = k;
  return {
    ...rest,
    avgWatchPct: watchWeight ? Math.round((watchSum / watchWeight) * 10) / 10 : null,
    conversion: k.visitors ? k.leads / k.visitors : null,
  };
}

function sumDims(rows: DimRow[], dim: DimRow["dim"]): DimStat[] {
  const map = new Map<string, DimStat>();
  for (const r of rows) {
    if (r.dim !== dim) continue;
    const s = map.get(r.key) ?? { key: r.key, visitors: 0, sessions: 0, pageviews: 0, plays: 0, leads: 0, clicks: 0 };
    s.visitors += r.visitors;
    s.sessions += r.sessions;
    s.pageviews += r.pageviews;
    s.plays += r.plays;
    s.leads += r.leads;
    s.clicks += r.clicks;
    map.set(r.key, s);
  }
  const score = (s: DimStat) => (dim === "cta" || dim === "outbound" ? s.clicks : s.sessions);
  return [...map.values()].sort((a, b) => score(b) - score(a));
}

/** Everything the dashboard shows for one range. Cached for a minute; today is read live. */
export async function getDashboard(from: string, to: string, prevFrom: string, prevTo: string, today: string): Promise<Dashboard> {
  "use cache";
  cacheTag(ANALYTICS_TAG);
  cacheLife("minutes");

  const [cur, prev] = await Promise.all([loadDays(from, to, today, false), loadDays(prevFrom, prevTo, today, true)]);
  const site = cur.pages.filter((p) => p.path === SITE);

  const byDay = new Map(site.map((r) => [r.day, r]));
  const series: DayPoint[] = eachDay(from, to).map((day) => {
    const r = byDay.get(day);
    return {
      day,
      visitors: r?.visitors ?? 0,
      pageviews: r?.pageviews ?? 0,
      plays: r?.videoPlays ?? 0,
      leads: r?.leads ?? 0,
      avgWatchPct: r?.avgWatchPct ?? null,
      conversion: r?.visitors ? r.leads / r.visitors : null,
    };
  });

  // Projects: per-path rows that carry a project id.
  const projAcc = new Map<string, PageRow[]>();
  const pageAcc = new Map<string, PageStat>();
  for (const r of cur.pages) {
    if (r.path === SITE) continue;
    if (r.projectId) projAcc.set(r.projectId, [...(projAcc.get(r.projectId) ?? []), r]);
    const p = pageAcc.get(r.path) ?? { path: r.path, pageviews: 0, visitors: 0, leads: 0 };
    p.pageviews += r.pageviews;
    p.visitors += r.visitors;
    p.leads += r.leads;
    pageAcc.set(r.path, p);
  }
  const meta = projAcc.size
    ? await db.project.findMany({ where: { id: { in: [...projAcc.keys()] } }, select: { id: true, title: true, slug: true } })
    : [];
  const projects: ProjectStat[] = meta
    .map((m) => {
      const k = sumKpis(projAcc.get(m.id)!);
      return {
        ...m,
        views: k.pageviews,
        visitors: k.visitors,
        plays: k.plays,
        completions: k.completions,
        completionRate: k.plays ? k.completions / k.plays : null,
        avgWatchPct: k.avgWatchPct,
        leads: k.leads,
      };
    })
    .sort((a, b) => b.views + b.plays * 2 - (a.views + a.plays * 2));

  const dimNames = ["source", "referrer", "device", "country", "browser", "cta", "outbound"] as const;
  return {
    kpis: sumKpis(site),
    previous: sumKpis(prev.pages),
    series,
    dims: Object.fromEntries(dimNames.map((d) => [d, sumDims(cur.dims, d)])) as Dashboard["dims"],
    projects,
    pages: [...pageAcc.values()].sort((a, b) => b.pageviews - a.pageviews).slice(0, 10),
  };
}

export type Live = { visitors: number; pageviews: number; pages: { path: string; views: number }[] };

/** Visitors in the last 30 minutes (polled by the dashboard; never cached). */
export async function getLive(now = new Date()): Promise<Live> {
  const since = new Date(now.getTime() - 30 * 60 * 1000);
  const [visitors, pageviews, pages] = await Promise.all([
    db.analyticsEvent.findMany({ where: { createdAt: { gte: since } }, distinct: ["visitorHash"], select: { visitorHash: true } }),
    db.analyticsEvent.count({ where: { type: "PAGEVIEW", createdAt: { gte: since } } }),
    db.analyticsEvent.groupBy({
      by: ["path"],
      where: { type: "PAGEVIEW", createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { path: "desc" } },
      take: 5,
    }),
  ]);
  return {
    visitors: visitors.length,
    pageviews,
    pages: pages.map((p) => ({ path: p.path, views: p._count._all })),
  };
}
