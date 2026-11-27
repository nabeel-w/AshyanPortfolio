import type { Person, WebSite, WithContext } from "schema-dts";
import type { ProjectDetail } from "@/features/content/projects";
import type { Site } from "@/features/content/queries";
import { isoDuration } from "@/features/media/delivery";
import { thumbnailUrl } from "@/lib/youtube";
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

/**
 * Only real profile URLs belong in sameAs: a bare domain ("https://instagram.com/") would claim the
 * whole platform as Ashyan. Requires a path beyond "/".
 */
export function profileUrls(socials: { href: string }[]): string[] {
  return socials
    .map((s) => s.href)
    .filter((href) => {
      try {
        const u = new URL(href);
        return /^https?:$/.test(u.protocol) && u.pathname.replace(/\/+$/, "").length > 0;
      } catch {
        return false;
      }
    });
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
    sameAs: profileUrls(site.socials),
    homeLocation: site.location ? { "@type": "Place", name: site.location } : undefined,
    knowsAbout: ["Film editing", "Colour grading", "Sound design", "Motion graphics", "Post-production"],
  };
}

/** Nominal pixel size for VideoObject: 1080 on the short edge, the long edge from the aspect. */
export function filmSize(aspect: number) {
  return aspect >= 1
    ? { width: Math.round(1080 * aspect), height: 1080 }
    : { width: 1080, height: Math.round(1080 / aspect) };
}

/**
 * Project page graph: the film as a VideoObject (when there is one) that is also the CreativeWork,
 * credited to #person, plus a BreadcrumbList. Text fields mirror the visible page (no hidden claims).
 */
export function projectJsonLd(p: ProjectDetail, site: Site) {
  const url = absoluteUrl(`/work/${p.slug}`);
  const primary = p.labels.find((l) => l.visible !== false);
  const image = p.cover.src.startsWith("http") ? p.cover.src : absoluteUrl(p.cover.src);
  const work = {
    "@type": p.film ? ["VideoObject", "CreativeWork"] : "CreativeWork",
    "@id": `${url}#work`,
    name: p.title,
    description: p.summary || undefined,
    url,
    image,
    // The format plus the primary label; every label is a keyword (#28)
    genre: [...new Set([p.format, p.labels[0]?.name].filter(Boolean))],
    keywords: p.labels.length ? p.labels.map((l) => l.name).join(", ") : undefined,
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
          thumbnailUrl: [image, thumbnailUrl(p.film.youtubeId)],
          uploadDate: (p.publishedAt ?? new Date(Date.UTC(p.year, 0, 1))).toISOString(),
          duration: p.film.duration ? isoDuration(p.film.duration) : undefined,
          // No contentUrl: the file is YouTube's, not ours. embedUrl is the player Google can index.
          embedUrl: p.film.embedUrl,
          sameAs: p.film.watchUrl,
          ...filmSize(p.film.aspect),
          transcript: p.transcript || undefined,
        }
      : {}),
  };
  const breadcrumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Work", item: absoluteUrl("/work") },
      ...(primary
        ? [{ "@type": "ListItem", position: 3, name: primary.name, item: absoluteUrl(`/work/label/${primary.slug}`) }]
        : []),
      { "@type": "ListItem", position: primary ? 4 : 3, name: p.title, item: url },
    ],
  };
  return { "@context": "https://schema.org", "@graph": [work, breadcrumbs] };
}

/**
 * /work/label/<slug>: a CollectionPage whose ItemList is the label's films (in grid order), plus a
 * BreadcrumbList Home › Work › Label. Mirrors the visible page.
 */
export function labelPageJsonLd(
  label: { name: string; slug: string; description?: string },
  projects: { slug: string; title: string }[],
) {
  const url = absoluteUrl(`/work/label/${label.slug}`);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name: `${label.name} — Work`,
        description: label.description,
        isPartOf: { "@id": absoluteUrl("/#website") },
        about: { "@id": absoluteUrl("/#person") },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: projects.length,
          itemListElement: projects.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(`/work/${p.slug}`),
            name: p.title,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Work", item: absoluteUrl("/work") },
          { "@type": "ListItem", position: 3, name: label.name, item: url },
        ],
      },
    ],
  };
}

/** /about: a ProfilePage whose main entity is the #person node (same @id as the site-wide Person). */
export function profilePageJsonLd(site: Site, dateModified?: Date) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": absoluteUrl("/about#page"),
    url: absoluteUrl("/about"),
    name: `About ${site.name}`,
    dateModified: dateModified?.toISOString(),
    mainEntity: { "@id": absoluteUrl("/#person") },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "About", item: absoluteUrl("/about") },
      ],
    },
  };
}

/** Mirrors a visible Q&A section exactly (no hidden answers). */
export function faqJsonLd(items: { question: string; answer: string }[], pageUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
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
