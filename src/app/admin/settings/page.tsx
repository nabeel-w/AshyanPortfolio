import { GoogleConnections } from "@/components/admin/google-connections";
import { SettingsForm } from "@/components/admin/settings-form";
import { ShareSettingsForm } from "@/components/admin/share/share-fields";
import { getSite } from "@/features/content/queries";
import { googleConfigured, listGoogleAccounts, pickerConfigured } from "@/features/google/accounts";
import { parseSiteShare } from "@/features/seo/share";
import { listShareTargets } from "@/features/seo/share-server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { SITE_URL } from "@/lib/site-url";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "sharing", label: "Sharing & SEO" },
  { id: "services", label: "Connected services" },
];

export default async function AdminSettingsPage() {
  // Each page segment can be rendered/prefetched on its own (partial prefetching), so it must
  // authorize itself rather than rely on the layout guard. Also makes the page request-time.
  const session = await requireAdmin();
  const [row, site, googleAccounts, targets] = await Promise.all([
    db.siteSettings.findUnique({ where: { id: "site" } }),
    getSite(),
    googleConfigured() ? listGoogleAccounts(session.user.id) : [],
    listShareTargets(),
  ]);
  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <div>
          <p className="label text-smoke">Site</p>
          <h1 className="font-serif text-4xl text-ivory">Settings</h1>
        </div>
        <nav aria-label="Settings sections" className="flex flex-wrap gap-1">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-red hover:text-ivory"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      <section id="profile" aria-labelledby="profile-title" className="scroll-mt-6 space-y-4">
        <div>
          <h2 id="profile-title" className="font-serif text-2xl text-ivory">
            Profile
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Your name, contact details and profiles — used in the header, footer, contact page, WhatsApp
            button and structured data.
          </p>
        </div>
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
      </section>

      <section id="sharing" aria-labelledby="sharing-title" className="scroll-mt-6 space-y-4 border-t border-hairline pt-8">
        <div>
          <h2 id="sharing-title" className="font-serif text-2xl text-ivory">
            Sharing &amp; SEO
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            How the site looks when a link is shared in WhatsApp, iMessage, LinkedIn or X, and in Google.
            The preview is the real card. Pages and projects can override it in their own editors.
          </p>
        </div>
        <ShareSettingsForm
          initial={parseSiteShare(row?.share)}
          targets={targets}
          site={{ name: site.name, role: site.role, location: site.location, description: site.description }}
          siteUrl={SITE_URL}
        />
      </section>

      <section id="services" aria-labelledby="services-title" className="scroll-mt-6 space-y-3 border-t border-hairline pt-8">
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
