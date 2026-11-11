import { signedPct } from "@/features/analytics/format";
import { delta as relChange } from "@/features/analytics/range";
import { cn } from "@/lib/utils";

/**
 * KPI tile: label · value · signed delta vs the previous period · sparkline.
 * Server-rendered SVG, no chart library. Delta carries an arrow, so direction never relies on colour.
 */
export function StatTile({
  label,
  value,
  current,
  previous,
  trend,
  hint,
  upIsGood = true,
}: {
  label: string;
  value: string;
  current: number | null;
  previous: number | null;
  trend: (number | null)[];
  hint?: string;
  upIsGood?: boolean;
}) {
  const change = current === null || previous === null ? undefined : relChange(current, previous);
  const good = change === undefined || change === null || change === 0 ? null : change > 0 === upIsGood;

  return (
    <div className="flex min-w-0 flex-col justify-between gap-3 rounded-md border border-border bg-onyx p-4 md:p-5">
      <p className="label text-smoke">{label}</p>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <p className="font-sans text-3xl font-semibold tracking-tight text-ivory md:text-4xl">{value}</p>
        {change !== undefined ? (
          <span
            className={cn("label shrink-0 tabular-nums", good === true && "text-ivory", good === false && "text-red-bright", good === null && "text-smoke")}
            title={`vs previous period${hint ? ` · ${hint}` : ""}`}
          >
            <span aria-hidden>{change === null ? "✦ " : change > 0 ? "▲ " : change < 0 ? "▼ " : ""}</span>
            {signedPct(change)}
            <span className="sr-only"> vs previous period</span>
          </span>
        ) : null}
      </div>
      <Sparkline values={trend} label={`${label} per day`} />
    </div>
  );
}

/**
 * 2px line in the de-emphasis grey; the latest point is a red dot with a surface ring. The line
 * stretches to the tile width, so the dot is an HTML element (an SVG circle would turn oval).
 */
export function Sparkline({ values, label, className }: { values: (number | null)[]; label: string; className?: string }) {
  const W = 100;
  const H = 28;
  if (values.length < 2) return <div className={cn("h-7", className)} />;
  const vals = values.map((v) => v ?? 0);
  const max = Math.max(...vals, 1);
  const x = (i: number) => (i / (vals.length - 1)) * W;
  const y = (v: number) => H - 3 - (v / max) * (H - 6);
  const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const last = vals.at(-1)!;
  return (
    <div role="img" aria-label={label} className={cn("relative h-7 w-full", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
        <path d={`${d} L${W},${H} L0,${H} Z`} fill="var(--color-smoke)" opacity={0.1} />
        <path d={d} fill="none" stroke="var(--color-smoke)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span
        aria-hidden
        className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-bright ring-2 ring-onyx"
        style={{ left: "100%", top: `${(y(last) / H) * 100}%` }}
      />
    </div>
  );
}
