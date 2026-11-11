import { num, pct } from "@/features/analytics/format";
import { cn } from "@/lib/utils";

/** Card shell shared by every dashboard panel. */
export function Panel({ title, subtitle, action, className, children }: { title: string; subtitle?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className={cn("flex min-w-0 flex-col rounded-md border border-border bg-onyx p-4 md:p-5", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ivory">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-smoke">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children = "No data in this range yet." }: { children?: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-smoke">{children}</p>;
}

export type BarItem = { key: string; label: string; value: number; highlight?: boolean; detail?: string };

/**
 * Ranked horizontal bars (HTML, no chart library): label left, value at the tip, a thin bar
 * with a rounded data end. One colour for every bar; `highlight` marks the one that matters
 * (AI traffic) in red. Hover or focus shows share and detail.
 */
export function BarList({ items, total, limit = 8, unit }: { items: BarItem[]; total?: number; limit?: number; unit?: string }) {
  if (!items.length) return <Empty />;
  const shown = items.slice(0, limit);
  const rest = items.slice(limit);
  if (rest.length) shown.push({ key: "__other", label: `Other (${rest.length})`, value: rest.reduce((n, r) => n + r.value, 0) });
  const max = Math.max(...shown.map((i) => i.value), 1);
  const sum = total ?? items.reduce((n, i) => n + i.value, 0);

  return (
    <ul className="space-y-1">
      {shown.map((item) => {
        const share = sum ? item.value / sum : 0;
        return (
          <li key={item.key} tabIndex={0} className="group relative rounded-sm px-1 py-1.5 outline-none hover:bg-graphite/60 focus-visible:bg-graphite/60 focus-visible:ring-1 focus-visible:ring-red">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={cn("min-w-0 truncate", item.highlight ? "text-ivory" : "text-ivory/80")}>
                {item.highlight ? <span aria-hidden className="mr-1.5 inline-block size-1.5 -translate-y-0.5 rounded-full bg-red-bright" /> : null}
                {item.label}
              </span>
              <span className="shrink-0 text-ivory tabular-nums">
                {num(item.value)}
                <span className="ml-2 text-xs text-smoke">{pct(share)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full">
              <div
                className={cn("h-full rounded-r-full", item.highlight ? "bg-red-bright" : "bg-[#b8b3ab]/70")}
                style={{ width: `${Math.max((item.value / max) * 100, item.value ? 1.5 : 0)}%` }}
              />
            </div>
            <span
              role="tooltip"
              className="pointer-events-none absolute right-1 bottom-full z-10 mb-1 hidden rounded-sm border border-border bg-ink px-2 py-1 text-xs whitespace-nowrap text-ivory shadow-lg group-hover:block group-focus-visible:block"
            >
              {item.label}: {num(item.value)}
              {unit ? ` ${unit}` : ""} · {pct(share)}
              {item.detail ? ` · ${item.detail}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Video retention: share of plays that reach each milestone. Ordered steps, one hue (red, the
 * video series), value at the tip; the drop between steps is printed so the leak is obvious.
 */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const base = steps[0]?.value ?? 0;
  if (!base) return <Empty>No film plays in this range yet.</Empty>;
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const share = s.value / base;
        const prev = i ? steps[i - 1].value : null;
        const drop = prev ? 1 - s.value / prev : null;
        return (
          <li key={s.label} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm">
            <span className="label text-smoke">{s.label}</span>
            <div className="h-2 w-full rounded-full bg-red-bright/12">
              <div className="h-full rounded-full bg-red-bright" style={{ width: `${Math.max(share * 100, s.value ? 1.5 : 0)}%` }} />
            </div>
            <span className="w-36 text-right text-ivory tabular-nums">
              {pct(share)} <span className="text-xs text-smoke">· {num(s.value)}</span>
              <span className="block text-[11px] text-smoke">{drop !== null && drop > 0 ? `−${pct(drop)} vs previous step` : i ? "no drop" : "of plays"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const SEGMENT_TONES = ["bg-red-bright text-ivory", "bg-[#b8b3ab] text-ink", "bg-[#6e6b66] text-ivory", "bg-graphite text-ivory"];

/** One whole split into parts (devices): a 28px tall segmented bar with a legend in block order. */
export function SegmentedBar({ parts, label }: { parts: { key: string; label: string; value: number }[]; label: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (!total) return <Empty />;
  const visible = parts.filter((p) => p.value > 0);
  const summary = visible.map((p) => `${p.label} ${pct(p.value / total)}`).join(", ");
  return (
    <div>
      <div role="img" aria-label={`${label}: ${summary}`} className="flex h-7 w-full gap-0.5">
        {visible.map((p, i) => {
          const share = p.value / total;
          return (
            <div
              key={p.key}
              title={`${p.label}: ${num(p.value)} · ${pct(share)}`}
              className={cn("flex items-center overflow-hidden rounded-[4px] px-2 text-xs font-medium", SEGMENT_TONES[i % SEGMENT_TONES.length])}
              style={{ width: `${share * 100}%` }}
            >
              {share >= 0.12 ? pct(share) : null}
            </div>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ivory/80">
        {visible.map((p, i) => (
          <li key={p.key} className="flex items-center gap-2">
            <span aria-hidden className={cn("size-2.5 rounded-[3px]", SEGMENT_TONES[i % SEGMENT_TONES.length].split(" ")[0])} />
            {p.label}
            <span className="text-smoke tabular-nums">{num(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
