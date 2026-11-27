import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { WorkGrid } from "@/components/site/work-grid";
import { chipLabels, getLabel, getLabels, getSite } from "@/features/content/queries";
import { JsonLd, labelPageJsonLd } from "@/features/seo/json-ld";

/**
 * /work/label/<slug>: a static, indexable page per label (#28). Same grid as /work, with this label's
 * chip active; every chip links to its own page. Renamed labels redirect from their old slugs.
 */
export async function generateStaticParams() {
  const slugs = (await getLabels()).filter((l) => l.count > 0).map((l) => ({ slug: l.slug }));
  // Cache Components needs at least one param; an unknown slug simply 404s.
  return slugs.length ? slugs : [{ slug: "film" }];
}

const introFor = (name: string, count: number, editor: string) =>
  `${count} ${name.toLowerCase()} ${count === 1 ? "project" : "projects"} edited by ${editor}.`;

export async function generateMetadata({ params }: PageProps<"/work/label/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [hit, site] = await Promise.all([getLabel(slug), getSite()]);
  if (!hit || "redirect" in hit) return {};
  const { label } = hit;
  const title = label.seoTitle || `${label.name} — Work`;
  const description =
    label.seoDescription || label.description || introFor(label.name, label.projects.length, site.name);
  const path = `/work/label/${label.slug}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      images: [{ url: `/opengraph-image?label=${label.slug}`, width: 1200, height: 630, alt: `${label.name} — ${site.name}` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`/opengraph-image?label=${label.slug}`] },
  };
}

export default async function LabelPage({ params }: PageProps<"/work/label/[slug]">) {
  const { slug } = await params;
  const [hit, labels, site] = await Promise.all([getLabel(slug), getLabels(), getSite()]);
  if (hit && "redirect" in hit) permanentRedirect(`/work/label/${hit.redirect}`);
  if (!hit || !hit.label.projects.length) notFound();
  const { label } = hit;

  return (
    <>
      {/* Above the fold: no data-reveal on the header (it's the LCP area). */}
      <header className="bg-ink pt-32 pb-12 md:pt-44 md:pb-16">
        <div className="container-site">
          <nav aria-label="Breadcrumb" className="label mb-6 text-smoke">
            <Link href="/work" className="hit-44 hover:text-ivory">
              Work
            </Link>
            <span aria-hidden className="mx-2 text-red">
              /
            </span>
            <span aria-current="page" className="text-red">
              {label.name}
            </span>
          </nav>
          <h1 className="max-w-5xl font-serif text-display text-ivory [text-wrap:balance]">
            {label.name} <em className="text-red italic">work.</em>
          </h1>
          <span aria-hidden className="mt-10 block h-px w-16 bg-red" />
          <p className="mt-8 max-w-xl text-[1.0625rem] leading-relaxed text-ivory/70">
            {label.description || introFor(label.name, label.projects.length, site.name)}
          </p>
        </div>
      </header>
      <WorkGrid
        bare
        label={`${label.name} work`}
        labels="auto"
        projects={label.projects}
        labelList={chipLabels("auto", labels)}
        chips="links"
        tone="ink"
        activeLabel={label.slug}
        position={1}
      />
      <JsonLd data={labelPageJsonLd(label, label.projects)} />
    </>
  );
}
