import type { Person, WebSite, WithContext } from "schema-dts";
import { site } from "@/content/fallback";
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

export function personJsonLd(): WithContext<Person> {
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

export function websiteJsonLd(): WithContext<WebSite> {
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
