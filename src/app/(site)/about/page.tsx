import { pageMetadata, PublishedPage } from "@/features/content/published-page";

export function generateMetadata() {
  return pageMetadata("about", "/about", {
    title: "About",
    description: "Ashyan Zafar is an independent film editor for brands, agencies and directors — editing, colour, sound and finishing.",
  });
}

export default function AboutPage() {
  return <PublishedPage slug="about" />;
}
