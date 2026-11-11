import "server-only";
import { db } from "@/lib/db";
import { aggregate, type RawEvent } from "./aggregate";

export const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC of the given instant. */
export const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export const rawSelect = {
  type: true,
  visitorHash: true,
  sessionHash: true,
  path: true,
  projectId: true,
  value: true,
  label: true,
  referrer: true,
  source: true,
  country: true,
  device: true,
  browser: true,
  createdAt: true,
} as const;

/** Raw events in [from, to), oldest first. */
export function rawEvents(from: Date, to: Date): Promise<(RawEvent & { createdAt: Date })[]> {
  return db.analyticsEvent.findMany({
    where: { createdAt: { gte: from, lt: to } },
    orderBy: { createdAt: "asc" },
    select: rawSelect,
  });
}

/** Recompute one UTC day. Idempotent: the day's rows are replaced in one transaction. */
export async function rollupDay(day: Date) {
  const start = utcDay(day);
  const { pages, dims } = aggregate(await rawEvents(start, addDays(start, 1)));
  await db.$transaction([
    db.analyticsDaily.deleteMany({ where: { day: start } }),
    db.analyticsDailyDim.deleteMany({ where: { day: start } }),
    db.analyticsDaily.createMany({ data: pages.map((p) => ({ ...p, day: start })) }),
    db.analyticsDailyDim.createMany({ data: dims.map((d) => ({ ...d, day: start })) }),
  ]);
  return { day: isoDay(start), pages: pages.length, dims: dims.length };
}

/**
 * Nightly job: roll up every finished day that has no rollup yet (always redoing yesterday, which
 * may have late events), then delete raw events past retention. Never rolls up today.
 */
export async function runRollups(now = new Date(), opts: { from?: Date; to?: Date } = {}) {
  const today = utcDay(now);
  const last = opts.to ? utcDay(opts.to) : addDays(today, -1);
  let first = opts.from ? utcDay(opts.from) : null;

  if (!first) {
    const [latest, oldest] = await Promise.all([
      db.analyticsDaily.findFirst({ orderBy: { day: "desc" }, select: { day: true } }),
      db.analyticsEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ]);
    first = latest ? addDays(utcDay(latest.day), 1) : oldest ? utcDay(oldest.createdAt) : last;
    if (first > last) first = last; // always redo yesterday
  }
  // Raw events older than the retention window are gone, so never "roll up" (wipe) those days.
  const floor = addDays(today, -RETENTION_DAYS);
  if (first < floor) first = floor;

  const days = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(await rollupDay(d));

  const pruned = await db.analyticsEvent.deleteMany({ where: { createdAt: { lt: floor } } });
  return { days, pruned: pruned.count };
}
