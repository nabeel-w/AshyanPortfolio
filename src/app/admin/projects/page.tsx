import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AdminProjectsList() {
  // Each page segment can be rendered/prefetched on its own (partial prefetching), so it must
  // authorize itself rather than rely on the layout guard. Also makes the page request-time.
  await requireAdmin();
  const projects = await db.project.findMany({
    orderBy: [{ status: "asc" }, { featured: "desc" }, { order: "asc" }, { updatedAt: "desc" }],
    include: {
      cover: true,
      category: true,
      loop: { select: { id: true } },
      film: { select: { id: true } },
    },
  });
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-smoke">Work</p>
          <h1 className="font-serif text-4xl text-ivory">Projects</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Each published project gets its own page at /work/… and appears in every work grid
            (featured first).
          </p>
        </div>
        <Button render={<Link href="/admin/projects/new" />}>+ New project</Button>
      </header>
      {projects.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">
          No projects yet.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/projects/${p.id}`}
                className="group block overflow-hidden rounded-md border border-border bg-onyx hover:border-red"
              >
                <div className="relative aspect-video bg-graphite">
                  {p.cover?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                    <img src={p.cover.url} alt="" className="size-full object-cover" />
                  ) : null}
                </div>
                <div className="space-y-2 p-4">
                  <p className="font-serif text-2xl text-ivory group-hover:text-red">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[p.format, p.year, p.category?.name].filter(Boolean).join(" · ")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={p.status === "PUBLISHED" ? "secondary" : "outline"}>
                      {p.status.toLowerCase()}
                    </Badge>
                    {p.featured ? <Badge variant="outline">featured</Badge> : null}
                    {p.loop ? <Badge variant="outline">hover loop</Badge> : null}
                    {p.film ? <Badge variant="outline">film</Badge> : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
