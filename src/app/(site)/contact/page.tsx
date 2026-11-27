import { pageDefaults, pageMetadata, PublishedPage } from "@/features/content/published-page";

export function generateMetadata() {
  return pageMetadata("contact", "/contact", pageDefaults.contact);
}

export default function ContactPage() {
  return <PublishedPage slug="contact" />;
}
