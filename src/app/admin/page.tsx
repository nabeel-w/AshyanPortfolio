import Link from "next/link";
import { KpiGrid } from "@/components/admin/analytics/kpi-grid";
import { getDashboard } from "@/features/analytics/queries";
import { resolveRange } from "@/features/analytics/range";
import { sectionState } from "@/features/pages/admin";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AdminOverview() {
  // Each page segment can be rendered/prefetched on its own (partial prefetching), so it must
  // authorize itself rather than rely on the layout guard. Also makes the page request-time.
  await requireAdmin();
  const [projects, published, assets, processing, unread, clients, sections] = await Promise.all([
    db.project.count(),
    db.project.count({ where: { status: "PUBLISHED" } }),
    db.asset.count({ where: { status: "READY" } }),
    db.asset.count({ where: { status: "PROCESSING" } }),
    db.contactSubmission.count({ where: { read: false } }),
    db.client.count({ where: { visible: true } }),
    db.section.findMany({
      select: {
        data: true,
        publishedData: true,
        order: true,
        publishedOrder: true,
        visible: true,
        publishedVisible: true,
      },
    }),
  ]);
  const drafts = sections.filter((s) => sectionState(s).dirty).length;
  const now = new Date();
  const week = resolveRange({ range: "7d" }, now);
  const analytics = await getDashboard(week.from, week.to, week.previous.from, week.previous.to, now.toISOString().slice(0, 10));

  const tiles = [
    { label: "Unread enquiries", value: unread, href: "/admin/inbox", hot: unread > 0 },
    { label: "Unpublished page changes", value: drafts, href: "/admin/pages", hot: drafts > 0 },
    {
      label: "Published projects",
      value: `${published}/${projects}`,
      href: "/admin/projects",
      hot: false,
    },
    {
      label: "Media files",
      value: processing ? `${assets} (+${processing})` : assets,
      href: "/admin/media",
      hot: false,
    },
    { label: "Clients in marquee", value: clients, href: "/admin/clients", hot: false },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="label text-smoke">Overview</p>
        <h1 className="font-serif text-4xl text-ivory">Good to see you.</h1>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className={`block rounded-md border bg-onyx p-5 transition-colors hover:border-red ${t.hot ? "border-red/60" : "border-border"}`}
            >
              <p className="label text-smoke">{t.label}</p>
              <p className="mt-3 font-serif text-4xl text-ivory">{t.value}</p>
            </Link>
          </li>
        ))}
      </ul>
      <section aria-labelledby="week-title" className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="week-title" className="label text-smoke">
            Last 7 days
          </h2>
          <Link href="/admin/analytics" className="label text-smoke hover:text-ivory">
            Full analytics →
          </Link>
        </div>
        <KpiGrid data={analytics} />
      </section>
    </div>
  );
}
