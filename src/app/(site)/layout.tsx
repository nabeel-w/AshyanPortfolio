import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";
import { enableRevealScript, RevealObserver } from "@/components/motion/reveal-observer";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { BladeCursor } from "@/components/site/blade-cursor";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { WhatsAppButton } from "@/components/site/whatsapp-button";
import { AnalyticsBeacon } from "@/features/analytics/beacon";
import { getSite } from "@/features/content/queries";
import { JsonLd, personJsonLd, websiteJsonLd } from "@/features/seo/json-ld";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const site = await getSite();
  return (
    <>
      {/* Pre-paint: turn on reveal styles only when JS runs. */}
      <script dangerouslySetInnerHTML={{ __html: enableRevealScript }} />
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
      <RevealObserver />
      <SmoothScroll />
      {/* Cookieless first-party analytics (docs/04) + real-user Core Web Vitals. */}
      <Suspense fallback={null}>
        <AnalyticsBeacon />
        <SpeedInsights />
      </Suspense>
      <div className="scroll-streak" aria-hidden />
      {site.whatsapp ? <WhatsAppButton phone={site.whatsapp} message={site.whatsappMessage} /> : null}
      <JsonLd data={personJsonLd(site)} />
      <JsonLd data={websiteJsonLd(site)} />
    </>
  );
}
