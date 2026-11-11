import type { Metadata } from "next";
import Link from "next/link";
import { KpiGrid } from "@/components/admin/analytics/kpi-grid";
import { LivePanel } from "@/components/admin/analytics/live-panel";
import { BarList, Empty, Funnel, Panel, SegmentedBar } from "@/components/admin/analytics/panels";
import { RangePicker } from "@/components/admin/analytics/range-picker";
import { TrafficChart } from "@/components/admin/analytics/traffic-chart";
import { countryName, ctaLabel, dayLabel, num, pageLabel, pct, pct100, sourceLabel } from "@/features/analytics/format";
import { getDashboard, getLive, type ProjectStat } from "@/features/analytics/queries";
import { resolveRange } from "@/features/analytics/range";
import { classifySource } from "@/features/analytics/source";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Analytics" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireAdmin();
  const sp = await searchParams;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const range = resolveRange({ range: one(sp.range), from: one(sp.from), to: one(sp.to) }, now);

  const [data, live, enquiries] = await Promise.all([
    getDashboard(range.from, range.to, range.previous.from, range.previous.to, today),
    getLive(now),
    db.contactSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, company: true, createdAt: true, read: true } }),
  ]);
  const { dims } = data;
  const sessions = data.kpis.sessions;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="label text-smoke">Analytics</p>
          <h1 className="font-serif text-4xl text-ivory">What gets watched.</h1>
          <p className="mt-1 text-sm text-smoke">
            {dayLabel(range.from)} – {dayLabel(range.to)} · {range.days} days (UTC) · compared with the {range.days} days before · cookieless
          </p>
        </div>
        <RangePicker range={range} today={today} />
      </header>

      <KpiGrid data={data} />

      <Panel title="Visitors & film plays" subtitle="Per day. Both are counts on one axis.">
        <TrafficChart data={data.series} />
        <details className="mt-3 text-sm">
          <summary className="label cursor-pointer text-smoke hover:text-ivory">View as table</summary>
          <div className="mt-3 max-h-72 overflow-auto">
            <table className="w-full text-left tabular-nums">
              <thead className="sticky top-0 bg-onyx text-xs text-smoke">
                <tr>
                  <th className="py-1.5 font-normal">Day</th>
                  <th className="py-1.5 text-right font-normal">Visitors</th>
                  <th className="py-1.5 text-right font-normal">Page views</th>
                  <th className="py-1.5 text-right font-normal">Film plays</th>
                  <th className="py-1.5 text-right font-normal">Enquiries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-ivory/80">
                {[...data.series].reverse().map((d) => (
                  <tr key={d.day}>
                    <td className="py-1.5">{dayLabel(d.day)}</td>
                    <td className="py-1.5 text-right">{num(d.visitors)}</td>
                    <td className="py-1.5 text-right">{num(d.pageviews)}</td>
                    <td className="py-1.5 text-right">{num(d.plays)}</td>
                    <td className="py-1.5 text-right">{num(d.leads)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Traffic sources" subtitle="Sessions by where they came from. AI assistants (GEO) in red.">
          <BarList
            unit="sessions"
            items={dims.source.map((s) => ({
              key: s.key,
              label: sourceLabel(s.key),
              value: s.sessions,
              highlight: s.key === "AI",
              detail: `${num(s.leads)} enquiries`,
            }))}
          />
        </Panel>
        <Panel title="Film retention" subtitle="Share of plays that reach each point of the film.">
          <Funnel
            steps={[
              { label: "Play", value: data.kpis.plays },
              { label: "25%", value: data.kpis.progress25 },
              { label: "50%", value: data.kpis.progress50 },
              { label: "75%", value: data.kpis.progress75 },
              { label: "Complete", value: data.kpis.completions },
            ]}
          />
        </Panel>
      </div>

      <Panel title="Top projects" subtitle="Views, plays and enquiries from sessions that opened the project.">
        <ProjectsTable projects={data.projects} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Top referrers" subtitle="Sites that sent visitors.">
          <BarList
            unit="sessions"
            items={dims.referrer.map((r) => ({ key: r.key, label: r.key, value: r.sessions, highlight: classifySource({ referrer: `https://${r.key}/` }) === "AI" }))}
          />
        </Panel>
        <Panel title="Devices" subtitle="Sessions by device.">
          <SegmentedBar
            label="Devices"
            parts={["mobile", "desktop", "tablet", "unknown"].map((k) => ({
              key: k,
              label: k[0].toUpperCase() + k.slice(1),
              value: dims.device.find((d) => d.key === k)?.sessions ?? 0,
            }))}
          />
          <h3 className="label mt-6 mb-2 text-smoke">Browsers</h3>
          <BarList limit={5} unit="sessions" items={dims.browser.map((b) => ({ key: b.key, label: b.key, value: b.sessions }))} />
        </Panel>
        <Panel title="Countries" subtitle="Sessions by country.">
          <BarList unit="sessions" items={dims.country.map((c) => ({ key: c.key, label: countryName(c.key), value: c.sessions }))} total={sessions} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Top pages" subtitle="Page views.">
          <BarList unit="views" items={data.pages.map((p) => ({ key: p.path, label: pageLabel(p.path), value: p.pageviews, detail: `${num(p.visitors)} visitors` }))} />
        </Panel>
        <Panel title="Clicks" subtitle="Calls to action and links out to other sites.">
          <BarList
            unit="clicks"
            items={[
              ...dims.cta.map((c) => ({ key: `cta:${c.key}`, label: ctaLabel(c.key), value: c.clicks })),
              ...dims.outbound.map((o) => ({ key: `out:${o.key}`, label: `↗ ${o.key}`, value: o.clicks })),
            ].sort((a, b) => b.value - a.value)}
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Right now">
          <LivePanel initial={live} />
        </Panel>
        <Panel title="Latest enquiries" action={<Link href="/admin/inbox" className="label text-smoke hover:text-ivory">Inbox →</Link>}>
          {enquiries.length ? (
            <ul className="divide-y divide-border">
              {enquiries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-ivory">
                    {!e.read ? <span aria-label="Unread" className="mr-2 inline-block size-1.5 -translate-y-0.5 rounded-full bg-red-bright" /> : null}
                    {e.name}
                    {e.company ? <span className="text-smoke"> · {e.company}</span> : null}
                  </span>
                  <time dateTime={e.createdAt.toISOString()} className="shrink-0 text-xs text-smoke">
                    {e.createdAt.toLocaleDateString("en", { day: "numeric", month: "short" })}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No enquiries yet.</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ProjectsTable({ projects }: { projects: ProjectStat[] }) {
  if (!projects.length) return <Empty>No project views in this range yet.</Empty>;
  return (
    <>
      {/* Desktop: table */}
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="text-xs text-smoke">
          <tr className="border-b border-border">
            <th className="pb-2 font-normal">Project</th>
            <th className="pb-2 text-right font-normal">Views</th>
            <th className="pb-2 text-right font-normal">Plays</th>
            <th className="w-48 pb-2 pl-6 font-normal">Completion</th>
            <th className="pb-2 text-right font-normal">Avg watch</th>
            <th className="pb-2 text-right font-normal">Enquiries</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border tabular-nums">
          {projects.map((p) => (
            <tr key={p.id} className="text-ivory/85">
              <td className="py-2.5">
                <Link href={`/admin/projects/${p.id}`} className="text-ivory hover:text-red-bright">
                  {p.title}
                </Link>
              </td>
              <td className="py-2.5 text-right">{num(p.views)}</td>
              <td className="py-2.5 text-right">{num(p.plays)}</td>
              <td className="py-2.5 pl-6">
                <Meter value={p.completionRate} />
              </td>
              <td className="py-2.5 text-right">{pct100(p.avgWatchPct)}</td>
              <td className="py-2.5 text-right">{p.leads ? <span className="text-ivory">{num(p.leads)}</span> : <span className="text-smoke">0</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Phone: cards */}
      <ul className="space-y-3 md:hidden">
        {projects.map((p) => (
          <li key={p.id} className="rounded-sm border border-border p-3">
            <Link href={`/admin/projects/${p.id}`} className="text-ivory">
              {p.title}
            </Link>
            <dl className="mt-2 grid grid-cols-4 gap-2 text-xs tabular-nums">
              {[
                ["Views", num(p.views)],
                ["Plays", num(p.plays)],
                ["Watch", pct100(p.avgWatchPct)],
                ["Enq.", num(p.leads)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-smoke">{k}</dt>
                  <dd className="text-ivory">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-2">
              <Meter value={p.completionRate} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Completion rate: red fill on a lighter track of the same tone. */
function Meter({ value }: { value: number | null }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 rounded-full bg-red-bright/15">
        <div className="h-full rounded-full bg-red-bright" style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
      </div>
      <span className="w-10 text-right text-xs text-ivory tabular-nums">{pct(value)}</span>
    </div>
  );
}
