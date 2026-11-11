import { getSite, getWorkList } from "@/features/content/queries";
import { absoluteUrl } from "@/lib/site-url";

/**
 * /llms.txt — a plain-markdown summary for AI answer engines (GEO).
 * Built from cached queries (tags "site" + "projects"), so it prerenders and refreshes on publish.
 */
export async function GET() {
  const [site, projects] = await Promise.all([getSite(), getWorkList()]);

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
