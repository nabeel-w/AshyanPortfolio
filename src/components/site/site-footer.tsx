import { getSite } from "@/features/content/queries";

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
                className="label inline-flex min-h-11 items-center text-ivory/70 transition-colors hover:text-red"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
