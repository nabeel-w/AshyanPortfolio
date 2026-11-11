import { pageMetadata, PublishedPage } from "@/features/content/published-page";

export function generateMetadata() {
  return pageMetadata("work", "/work", {
    title: "Work",
    description: "Selected films edited by Ashyan Zafar: commercials, fashion films, short films and documentaries.",
  });
}

export default function WorkPage() {
  return <PublishedPage slug="work" />;
}
