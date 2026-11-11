import { Intro } from "@/components/site/intro";
import { PublishedPage } from "@/features/content/published-page";
import { getSite } from "@/features/content/queries";

// Sections come from /admin/pages/home (publishedData only). Cached + tagged "page:home".
// The CUTLINE-style intro plays once per session over the hero.
export default async function HomePage() {
  const site = await getSite();
  return (
    <>
      <Intro name={site.name} />
      <PublishedPage slug="home" />
    </>
  );
}
