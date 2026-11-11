import Link from "next/link";
import { getSite } from "@/features/content/queries";
import { MobileMenu } from "./mobile-menu";

export async function SiteHeader() {
  const site = await getSite();
  return (
    <header className="site-header fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)]">
      <div className="container-site flex h-16 items-center justify-between md:h-20">
        <Link href="/" className="font-sans text-xs font-medium tracking-[0.42em] text-ivory uppercase sm:text-sm">
          {site.name}
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8 lg:gap-10">
            {site.nav.map((item, i) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="label group flex items-center gap-1.5 text-ivory/70 transition-colors hover:text-ivory"
                >
                  <span className="text-smoke tabular-nums group-hover:text-red">{String(i + 1).padStart(2, "0")}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <MobileMenu items={site.nav} email={site.email} socials={site.socials} />
      </div>
    </header>
  );
}
