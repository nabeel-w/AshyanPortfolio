import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { listPagesForAdmin } from "@/features/pages/admin";

export default async function AdminPagesList() {
  const pages = await listPagesForAdmin();
  return (
    <div className="space-y-8">
      <header>
        <p className="label text-smoke">Content</p>
        <h1 className="font-serif text-4xl text-ivory">Pages</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Every page is a stack of sections. Edit the text and images with a live preview; changes stay in draft until you
          publish the page.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {pages.map((p) => (
          <li key={p.id}>
            <Link
              href={`/admin/pages/${p.slug}`}
              className="flex h-full flex-col justify-between gap-6 rounded-md border border-border bg-onyx p-5 transition-colors hover:border-red"
            >
              <div>
                <p className="label text-smoke">/{p.slug === "home" ? "" : p.slug}</p>
                <p className="mt-1 font-serif text-3xl text-ivory">{p.title}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{p.sections} sections</Badge>
                {p.pendingChanges ? <Badge variant="outline">{p.pendingChanges} unpublished</Badge> : <Badge variant="outline">Live</Badge>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
