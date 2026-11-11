import { homeSections } from "@/content/fallback";
import { SectionRenderer } from "@/features/sections/registry";

// TODO(db): replace with getPublishedPage("home") — a "use cache" + cacheTag("page:home") query
// that the admin "Publish" action invalidates. See docs/02-architecture.md#rendering--caching.
export default function HomePage() {
  return <SectionRenderer sections={homeSections} />;
}
