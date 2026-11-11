import { BladeCursor } from "@/components/site/blade-cursor";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { JsonLd, personJsonLd, websiteJsonLd } from "@/features/seo/json-ld";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="label sr-only fixed top-3 left-3 z-[200] bg-ivory px-3 py-2 text-ink focus:not-sr-only"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <BladeCursor />
      <JsonLd data={personJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
    </>
  );
}
