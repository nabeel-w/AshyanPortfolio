import { MediaLibrary } from "@/components/admin/media-library";
import { toAssetSummary } from "@/features/media/summary";
import { db } from "@/lib/db";

export default async function AdminMediaPage() {
  const assets = await db.asset.findMany({
    where: { status: { not: "UPLOADING" } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return (
    <div className="space-y-8">
      <header>
        <p className="label text-smoke">Library</p>
        <h1 className="font-serif text-4xl text-ivory">Media</h1>
      </header>
      <MediaLibrary initial={assets.map(toAssetSummary)} />
    </div>
  );
}
