import { SettingsForm } from "@/components/admin/settings-form";
import { getSite } from "@/features/content/queries";
import { db } from "@/lib/db";

export default async function AdminSettingsPage() {
  const [row, site] = await Promise.all([db.siteSettings.findUnique({ where: { id: "site" } }), getSite()]);
  return (
    <div className="space-y-8">
      <header>
        <p className="label text-smoke">Site</p>
        <h1 className="font-serif text-4xl text-ivory">Settings</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Your name, contact details and profiles — used in the header, footer, contact page, WhatsApp button and
          structured data.
        </p>
      </header>
      <SettingsForm
        initial={{
          name: row?.name ?? site.name,
          role: row?.role ?? site.role,
          location: row?.location ?? site.location,
          email: row?.email ?? site.email,
          whatsapp: row?.whatsapp ?? site.whatsapp ?? "",
          whatsappMessage: row?.whatsappMessage ?? site.whatsappMessage,
          bio: row?.bio ?? site.description,
          socials: site.socials,
        }}
      />
    </div>
  );
}
