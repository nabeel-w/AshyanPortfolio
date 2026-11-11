import type { Person, WebSite, WithContext } from "schema-dts";
import type { ProjectDetail } from "@/features/content/projects";
import type { Site } from "@/features/content/queries";
import { isoDuration, mux } from "@/features/media/delivery";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Structured data is the main GEO lever: AI answer engines and Google both read it.
 * Person = who Ashyan is; WebSite = the entity graph root. Project pages add VideoObject + CreativeWork.
 */
export function JsonLd({ data }: { data: WithContext<Person> | WithContext<WebSite> | object }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" so content can never break out of the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function personJsonLd(site: Site): WithContext<Person> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": absoluteUrl("/#person"),
    name: site.name,
    jobTitle: site.role,
    description: site.description,
    url: absoluteUrl("/"),
    email: `mailto:${site.email}`,
    sameAs: site.socials.map((s) => s.href),
    knowsAbout: ["Film editing", "Colour grading", "Sound design", "Motion graphics", "Post-production"],
  };
}

/**
 * Project page graph: the film as a VideoObject (when there is one) that is also the CreativeWork,
 * credited to #person, plus a BreadcrumbList. Text fields mirror the visible page (no hidden claims).
 */
export function projectJsonLd(p: ProjectDetail, site: Site) {
  const url = absoluteUrl(`/work/${p.slug}`);
  const image = p.cover.src.startsWith("http") ? p.cover.src : absoluteUrl(p.cover.src);
  const work = {
    "@type": p.film ? ["VideoObject", "CreativeWork"] : "CreativeWork",
    "@id": `${url}#work`,
    name: p.title,
    description: p.summary || undefined,
    url,
    image,
    genre: p.format,
    dateCreated: String(p.year),
    datePublished: p.publishedAt?.toISOString(),
    dateModified: p.updatedAt?.toISOString(),
    inLanguage: "en",
    editor: { "@id": absoluteUrl("/#person") },
    creator: { "@id": absoluteUrl("/#person") },
    sourceOrganization: p.clientName ? { "@type": "Organization", name: p.clientName } : undefined,
    contributor: p.credits
      .filter((c) => c.name !== site.name)
      .map((c) => ({ "@type": "Person", name: c.name, jobTitle: c.role })),
    ...(p.film
      ? {
          thumbnailUrl: [image, mux.poster(p.film.playbackId, 1)],
          uploadDate: (p.publishedAt ?? new Date(Date.UTC(p.year, 0, 1))).toISOString(),
          duration: p.film.duration ? isoDuration(p.film.duration) : undefined,
          contentUrl: mux.mp4(p.film.playbackId),
          embedUrl: url,
        }
      : {}),
  };
  const breadcrumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Work", item: absoluteUrl("/work") },
      { "@type": "ListItem", position: 3, name: p.title, item: url },
    ],
  };
  return { "@context": "https://schema.org", "@graph": [work, breadcrumbs] };
}

export function websiteJsonLd(site: Site): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: site.name,
    url: absoluteUrl("/"),
    publisher: { "@id": absoluteUrl("/#person") },
    inLanguage: "en",
  };
}
