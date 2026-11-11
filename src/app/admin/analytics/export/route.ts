import { getDashboard } from "@/features/analytics/queries";
import { resolveRange } from "@/features/analytics/range";
import { auth } from "@/lib/auth";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote, and defuse spreadsheet formulas in text cells.
  return /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `"'${s.replace(/"/g, '""')}"` : /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV export of the dashboard: daily totals, then per-project and per-source tables. Admin only. */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || session.user.role !== "ADMIN") return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const now = new Date();
  const range = resolveRange({ range: "custom", from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined }, now);
  const d = await getDashboard(range.from, range.to, range.previous.from, range.previous.to, now.toISOString().slice(0, 10));

  const rows: unknown[][] = [
    ["day", "visitors", "pageviews", "film_plays", "enquiries", "avg_watch_pct", "conversion"],
    ...d.series.map((s) => [s.day, s.visitors, s.pageviews, s.plays, s.leads, s.avgWatchPct ?? "", s.conversion === null ? "" : s.conversion.toFixed(4)]),
    [],
    ["project", "slug", "views", "visitors", "plays", "completions", "completion_rate", "avg_watch_pct", "enquiries"],
    ...d.projects.map((p) => [p.title, p.slug, p.views, p.visitors, p.plays, p.completions, p.completionRate?.toFixed(4) ?? "", p.avgWatchPct ?? "", p.leads]),
    [],
    ["source", "visitors", "sessions", "pageviews", "plays", "enquiries"],
    ...d.dims.source.map((s) => [s.key, s.visitors, s.sessions, s.pageviews, s.plays, s.leads]),
  ];
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="analytics-${range.from}_${range.to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
