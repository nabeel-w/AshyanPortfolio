import { pageDefaults, pageMetadata, PublishedPage } from "@/features/content/published-page";

export function generateMetadata() {
  return pageMetadata("work", "/work", pageDefaults.work);
}

export default function WorkPage() {
  return <PublishedPage slug="work" />;
}
