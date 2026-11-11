import type { Metadata } from "next";
import { WorkGrid } from "@/components/site/work-grid";
import { getWorkList } from "@/features/content/queries";

export const metadata: Metadata = {
  title: "Work",
  description: "Selected films edited by Ashyan Zafar: commercials, fashion films, short films and documentaries.",
  alternates: { canonical: "/work" },
};

const CATEGORIES = ["All", "Commercial", "Fashion", "Film", "Documentary"];

export default async function WorkIndexPage() {
  const projects = await getWorkList();
  return (
    <div className="pt-16 md:pt-20">
      <WorkGrid label="Selected work" categories={CATEGORIES} projects={projects} tone="ink" />
    </div>
  );
}
