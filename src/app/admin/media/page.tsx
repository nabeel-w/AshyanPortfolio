import { MediaLibrary } from "@/components/admin/media-library";
import { toAssetSummary } from "@/features/media/summary";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AdminMediaPage({ searchParams }: PageProps<"/admin/media">) {
  // Each page segment can be rendered/prefetched on its own (partial prefetching), so it must
  // authorize itself rather than rely on the layout guard. Also makes the page request-time.
  await requireAdmin();
  const [assets, { upload }] = await Promise.all([
    db.asset.findMany({
      // Server imports show while UPLOADING (with progress); abandoned browser uploads stay hidden.
      where: { OR: [{ status: { not: "UPLOADING" } }, { import: { isNot: null } }] },
      include: { import: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    searchParams,
  ]);
  return (
    <div className="space-y-8">
      <header>
        <p className="label text-smoke">Library</p>
        <h1 className="font-serif text-4xl text-ivory">Media</h1>
      </header>
      <MediaLibrary initial={assets.map(toAssetSummary)} openUpload={upload !== undefined} />
    </div>
  );
}
