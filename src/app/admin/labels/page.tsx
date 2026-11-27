import { LabelManager } from "@/components/admin/label-manager";
import { listLabels } from "@/features/labels/actions";
import { requireAdmin } from "@/lib/session";

export default async function AdminLabelsPage() {
  // Each page segment can be rendered/prefetched on its own (partial prefetching), so it must
  // authorize itself rather than rely on the layout guard. Also makes the page request-time.
  await requireAdmin();
  const labels = await listLabels();
  return (
    <div className="space-y-8">
      <header>
        <p className="label text-smoke">Work</p>
        <h1 className="font-serif text-4xl text-ivory">Labels</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The labels on every film card, the filter chips on /work and a page per label at
          /work/label/…. Their order here is the chip order everywhere. Hidden labels stay on their
          projects but get no chip and no page.
        </p>
      </header>
      <LabelManager initial={labels} />
    </div>
  );
}
