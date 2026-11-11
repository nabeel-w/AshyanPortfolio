import { getPublishedPage } from "@/features/content/queries";
import { SectionRenderer } from "@/features/sections/registry";

// Cached + tagged "page:home" — prerendered, refreshed only when the page is published.
export default async function HomePage() {
  const sections = await getPublishedPage("home");
  return <SectionRenderer sections={sections} />;
}
