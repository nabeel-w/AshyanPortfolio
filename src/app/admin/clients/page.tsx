import { ClientManager } from "@/components/admin/client-manager";
import { getPublishedPage } from "@/features/content/queries";
import { toAssetSummary } from "@/features/media/summary";
import { db } from "@/lib/db";

export default async function AdminClientsPage() {
  const [clients, home] = await Promise.all([
    db.client.findMany({ orderBy: { order: "asc" }, include: { logo: true } }),
    getPublishedPage("home"),
  ]);
  const marquee = home.find((s) => s.type === "clientMarquee");
  const fallbackNames = marquee?.type === "clientMarquee" ? marquee.data.clients.map((c) => c.name) : [];
  return (
    <div className="space-y-8">
      <header>
        <p className="label text-smoke">Marquee</p>
        <h1 className="font-serif text-4xl text-ivory">Clients</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          The rotating logo strip on the site. Add clients, give them logos, set the order — saving makes it live.
        </p>
      </header>
      <ClientManager
        fallbackNames={fallbackNames}
        initial={clients.map((c) => ({
          id: c.id,
          name: c.name,
          url: c.url ?? "",
          visible: c.visible,
          logo: c.logo ? toAssetSummary(c.logo) : null,
        }))}
      />
    </div>
  );
}
