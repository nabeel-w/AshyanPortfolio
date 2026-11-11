import { homeSections, site } from "@/content/fallback";
import { absoluteUrl } from "@/lib/site-url";

/**
 * /llms.txt — a plain-markdown summary for AI answer engines (GEO).
 * No request data is read, so it prerenders at build. When it reads the DB, wrap the
 * query in "use cache" + cacheTag("site") so publishing refreshes it.
 */

export function GET() {
  const work = homeSections.find((s) => s.type === "workGrid");
  const projects = work?.type === "workGrid" ? work.data.projects : [];

  const body = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `- Role: ${site.role}`,
    `- Based: ${site.location}`,
    `- Contact: ${site.email}`,
    "",
    "## Selected work",
    ...projects.map((p) => `- [${p.title}](${absoluteUrl(`/work/${p.slug}`)}): ${p.format}, ${p.year}`),
    "",
    "## Profiles",
    ...site.socials.map((s) => `- [${s.label}](${s.href})`),
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
