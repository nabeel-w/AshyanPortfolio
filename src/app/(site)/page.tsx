import { PublishedPage } from "@/features/content/published-page";

// Sections come from /admin/pages/home (publishedData only). Cached + tagged "page:home".
export default function HomePage() {
  return <PublishedPage slug="home" />;
}
