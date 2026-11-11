import { getProject } from "@/features/content/projects";
import { getPublishedPage, getSite, getWorkList } from "@/features/content/queries";
import { clockDuration } from "@/features/media/delivery";
import { profileUrls } from "@/features/seo/json-ld";
import { absoluteUrl } from "@/lib/site-url";

/**
 * /llms-full.txt — the whole site as plain markdown for AI assistants (GEO): who Ashyan is, what he
 * does, every published film with its story and credits, and the Q&A. Built from the same cached
 * queries as the pages (tags site / page:* / projects), so it refreshes whenever content is published.
 */
const strip = (t: string) => t.replace(/\*\*?([^*]+)\*\*?/g, "$1");

export async function GET() {
  const [site, about, work] = await Promise.all([getSite(), getPublishedPage("about"), getWorkList()]);
  const projects = (await Promise.all(work.map((w) => getProject(w.slug)))).filter((p) => p !== null);

  const lines: string[] = [
    `# ${site.name} — ${site.role}`,
    "",
    `> ${site.description}`,
    "",
    `- Website: ${absoluteUrl("/")}`,
    `- Based: ${site.location}`,
    `- Email: ${site.email}`,
    ...(site.whatsapp ? [`- WhatsApp: ${site.whatsapp}`] : []),
    ...profileUrls(site.socials).map((u) => `- Profile: ${u}`),
    "",
  ];

  for (const s of about) {
    if (s.type === "bio" && s.data.body) {
      lines.push("## About", "", ...s.data.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).flatMap((p) => [p, ""]));
      if (s.data.stats.length) lines.push(s.data.stats.map((x) => `${x.value} ${x.label.toLowerCase()}`).join(" · "), "");
    }
    if (s.type === "services" && s.data.items.length) {
      lines.push(`## ${strip(s.data.title)}`, "", ...s.data.items.map((i) => `- **${i.title}** — ${i.description}`), "");
    }
    if (s.type === "clientList" && s.data.groups.length) {
      lines.push("## Clients", "", ...s.data.groups.map((g) => `- ${g.label}: ${g.names.join(", ")}`), "");
    }
    if (s.type === "faq" && s.data.items.length) {
      lines.push("## Questions", "", ...s.data.items.flatMap((i) => [`### ${i.question}`, "", i.answer, ""]));
    }
  }

  lines.push("## Work", "");
  for (const p of projects) {
    lines.push(`### ${p.title}`, "");
    lines.push(
      [
        `${p.format}, ${p.year}`,
        p.clientName && `client: ${p.clientName}`,
        p.role && `role: ${p.role}`,
        p.film?.duration && `runtime ${clockDuration(p.film.duration)}`,
      ]
        .filter(Boolean)
        .join(" · "),
      "",
      `URL: ${absoluteUrl(`/work/${p.slug}`)}`,
      "",
    );
    if (p.summary) lines.push(p.summary, "");
    for (const para of p.story) lines.push(para, "");
    if (p.credits.length) lines.push(`Credits: ${p.credits.map((c) => `${c.role} — ${c.name}`).join("; ")}`, "");
  }

  lines.push("## Contact", "", `Enquiries: ${absoluteUrl("/contact")} or ${site.email}.`, "");

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
