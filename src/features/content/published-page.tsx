import type { Metadata } from "next";
import { SectionRenderer } from "@/features/sections/registry";
import { faqJsonLd, JsonLd, profilePageJsonLd } from "@/features/seo/json-ld";
import { absoluteUrl } from "@/lib/site-url";
import { getPageMeta, getPublishedPage, getSite } from "./queries";

const pathFor = (slug: string) => (slug === "home" ? "/" : `/${slug}`);

/**
 * Renders a CMS page's live sections. Cached per page tag — prerendered, refreshed on publish.
 * Structured data is derived from the same sections so it always matches what's on screen.
 */
export async function PublishedPage({ slug }: { slug: string }) {
  const [sections, site] = await Promise.all([getPublishedPage(slug), getSite()]);
  const faqs = sections.flatMap((s) => (s.type === "faq" ? s.data.items : []));
  return (
    <>
      <SectionRenderer sections={sections} site={site} />
      {slug === "about" ? <JsonLd data={profilePageJsonLd(site)} /> : null}
      {faqs.length ? <JsonLd data={faqJsonLd(faqs, absoluteUrl(pathFor(slug)))} /> : null}
    </>
  );
}

/** Page metadata from the admin SEO fields, falling back to sensible defaults. */
export async function pageMetadata(
  slug: string,
  path: string,
  defaults: { title: string; description: string },
): Promise<Metadata> {
  const meta = await getPageMeta(slug);
  const title = meta.title ?? defaults.title;
  const description = meta.description ?? defaults.description;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
  };
}
