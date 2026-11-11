import { num, pct, pct100 } from "@/features/analytics/format";
import type { Dashboard } from "@/features/analytics/queries";
import { StatTile } from "./stat-tile";

/** The six headline KPIs with deltas and sparklines. Also used on the admin overview. */
export function KpiGrid({ data }: { data: Pick<Dashboard, "kpis" | "previous" | "series"> }) {
  const { kpis: k, previous: p, series } = data;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
      <StatTile label="Visitors" value={num(k.visitors)} current={k.visitors} previous={p.visitors} trend={series.map((d) => d.visitors)} hint="unique per day" />
      <StatTile label="Page views" value={num(k.pageviews)} current={k.pageviews} previous={p.pageviews} trend={series.map((d) => d.pageviews)} />
      <StatTile label="Film plays" value={num(k.plays)} current={k.plays} previous={p.plays} trend={series.map((d) => d.plays)} />
      <StatTile label="Avg watch" value={pct100(k.avgWatchPct)} current={k.avgWatchPct} previous={p.avgWatchPct} trend={series.map((d) => d.avgWatchPct)} hint="furthest milestone per play" />
      <StatTile label="Enquiries" value={num(k.leads)} current={k.leads} previous={p.leads} trend={series.map((d) => d.leads)} />
      <StatTile label="Conversion" value={pct(k.conversion)} current={k.conversion} previous={p.conversion} trend={series.map((d) => d.conversion)} hint="enquiries ÷ visitors" />
    </div>
  );
}
