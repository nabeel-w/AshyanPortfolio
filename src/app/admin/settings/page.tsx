import { GoogleConnections } from "@/components/admin/google-connections";
import { SettingsForm } from "@/components/admin/settings-form";
import { getSite } from "@/features/content/queries";
import { googleConfigured, listGoogleAccounts, pickerConfigured } from "@/features/google/accounts";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function AdminSettingsPage() {
  // Each page segment can be rendered/prefetched on its own (partial prefetching), so it must
  // authorize itself rather than rely on the layout guard. Also makes the page request-time.
  const session = await requireAdmin();
  const [row, site, googleAccounts] = await Promise.all([
    db.siteSettings.findUnique({ where: { id: "site" } }),
    getSite(),
    googleConfigured() ? listGoogleAccounts(session.user.id) : [],
  ]);
  return (
    <div className="space-y-8">
      <header>
        <p className="label text-smoke">Site</p>
        <h1 className="font-serif text-4xl text-ivory">Settings</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Your name, contact details and profiles — used in the header, footer, contact page,
          WhatsApp button and structured data.
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
      <section aria-labelledby="services-title" className="space-y-3 border-t border-hairline pt-8">
        <div>
          <h2 id="services-title" className="font-serif text-2xl text-ivory">
            Connected services
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            A Google account linked to this admin. It can&apos;t be used to sign in.
          </p>
        </div>
        <GoogleConnections
          initial={{
            configured: googleConfigured(),
            pickerConfigured: pickerConfigured(),
            accounts: googleAccounts,
          }}
        />
      </section>
    </div>
  );
}
