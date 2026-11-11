import type { Metadata } from "next";
import { SectionRenderer } from "@/features/sections/registry";
import { getPageMeta, getPublishedPage, getSite } from "./queries";

/** Renders a CMS page's live sections. Cached per page tag — prerendered, refreshed on publish. */
export async function PublishedPage({ slug }: { slug: string }) {
  const [sections, site] = await Promise.all([getPublishedPage(slug), getSite()]);
  return <SectionRenderer sections={sections} site={site} />;
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
