import { pageDefaults, pageMetadata, PublishedPage } from "@/features/content/published-page";

export function generateMetadata() {
  return pageMetadata("about", "/about", pageDefaults.about);
}

export default function AboutPage() {
  return <PublishedPage slug="about" />;
}
