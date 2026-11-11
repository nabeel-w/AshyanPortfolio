import { pageMetadata, PublishedPage } from "@/features/content/published-page";

export function generateMetadata() {
  return pageMetadata("contact", "/contact", {
    title: "Contact",
    description: "Hire Ashyan Zafar, film editor. Tell me about your project and I'll reply within 24 hours.",
  });
}

export default function ContactPage() {
  return <PublishedPage slug="contact" />;
}
