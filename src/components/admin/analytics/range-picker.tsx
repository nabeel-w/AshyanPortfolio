import Link from "next/link";
import { PRESETS, type Range } from "@/features/analytics/range";
import { cn } from "@/lib/utils";

/**
 * One filter row above everything it scopes. Presets are links; the custom range is a plain GET
 * form, so the whole control works without client JS.
 */
export function RangePicker({ range, today }: { range: Range; today: string }) {
  const item = "label inline-flex h-9 items-center rounded-sm px-3 transition-colors";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Date range" className="flex rounded-md border border-border bg-onyx p-0.5">
        {PRESETS.map((p) => (
          <Link
            key={p}
            href={`/admin/analytics?range=${p}`}
            aria-current={range.preset === p ? "page" : undefined}
            className={cn(item, range.preset === p ? "bg-ivory text-ink" : "text-smoke hover:text-ivory")}
          >
            {p}
          </Link>
        ))}
      </nav>
      <form method="get" action="/admin/analytics" className="flex w-full min-w-0 items-center gap-1.5 rounded-md border border-border bg-onyx p-0.5 pl-2 sm:w-auto">
        <input type="hidden" name="range" value="custom" />
        <label className="sr-only" htmlFor="range-from">From</label>
        <input id="range-from" type="date" name="from" defaultValue={range.from} max={today} className="h-8 min-w-0 flex-1 rounded-sm bg-transparent px-1 text-sm text-ivory [color-scheme:dark] sm:flex-none" />
        <span aria-hidden className="text-smoke">→</span>
        <label className="sr-only" htmlFor="range-to">To</label>
        <input id="range-to" type="date" name="to" defaultValue={range.to} max={today} className="h-8 min-w-0 flex-1 rounded-sm bg-transparent px-1 text-sm text-ivory [color-scheme:dark] sm:flex-none" />
        <button type="submit" className={cn(item, range.preset === "custom" ? "bg-ivory text-ink" : "text-smoke hover:text-ivory")}>
          Custom
        </button>
      </form>
      <a href={`/admin/analytics/export?from=${range.from}&to=${range.to}`} className={cn(item, "border border-border bg-onyx text-smoke hover:text-ivory")} download>
        ⤓ CSV
      </a>
    </div>
  );
}
