import { getSite } from "@/features/content/queries";
import { SocialIcon } from "./social-icon";

export async function SiteFooter() {
  const site = await getSite();
  return (
    <footer className="border-t border-hairline bg-ink pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="container-site flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="label text-smoke">
          © {site.copyrightYear} {site.name}. All rights reserved.
        </p>
        <ul className="flex gap-6">
          {site.socials.map((s) => (
            <li key={s.label}>
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="label inline-flex min-h-11 min-w-11 items-center justify-center gap-2 text-ivory/70 transition-colors hover:text-red sm:min-w-0 sm:justify-start"
              >
                <SocialIcon href={s.href} />
                <span className="hidden sm:inline">{s.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
