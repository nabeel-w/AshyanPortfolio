import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmPlayer } from "@/components/media/film-player";
import { getProject, getProjectSlugs } from "@/features/content/projects";
import { getSite } from "@/features/content/queries";
import { clockDuration } from "@/features/media/delivery";
import { JsonLd, projectJsonLd } from "@/features/seo/json-ld";

export async function generateStaticParams() {
  return (await getProjectSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProject(slug);
  if (!p) return {};
  const title = `${p.title} — ${p.format}`;
  const description = p.summary || `${p.title}, a ${p.format.toLowerCase()} edited by Ashyan Zafar.`;
  return {
    title,
    description,
    alternates: { canonical: `/work/${p.slug}` },
    openGraph: {
      type: p.film ? "video.other" : "article",
      url: `/work/${p.slug}`,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProjectPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const [p, site] = await Promise.all([getProject(slug), getSite()]);
  if (!p) notFound();

  const facts = [
    ["Client", p.clientName],
    ["Format", p.format],
    ["Year", String(p.year)],
    ["Role", p.role],
    ["Runtime", p.film?.duration ? clockDuration(p.film.duration) : undefined],
  ].filter((f): f is [string, string] => Boolean(f[1]));

  return (
    <article className="bg-ink pt-16 md:pt-20">
      {/* Film (or still) — full-bleed, capped so the title stays near the fold */}
      <div className="relative">
        {p.film ? (
          <FilmPlayer
            playbackId={p.film.playbackId}
            title={p.title}
            duration={p.film.duration}
            aspectRatio={p.film.aspectRatio}
            poster={p.cover}
            priority
            className="max-h-[82svh]"
          />
        ) : (
          <div className="relative aspect-video max-h-[82svh] w-full">
            <Image src={p.cover.src} alt={p.cover.alt} fill preload fetchPriority="high" quality={90} sizes="100vw" className="object-cover" />
          </div>
        )}
      </div>

      <div className="container-site grid gap-12 py-14 md:py-20 lg:grid-cols-12 lg:gap-16">
        <header className="lg:col-span-7">
          <nav aria-label="Breadcrumb" className="label mb-6 text-smoke">
            <Link href="/work" className="hover:text-ivory">
              Work
            </Link>
            <span className="mx-2 text-red">/</span>
            {p.category}
          </nav>
          <h1 className="font-serif text-headline text-ivory [text-wrap:balance]">{p.title}</h1>
          {p.summary ? (
            <p className="mt-6 max-w-2xl font-serif text-2xl leading-snug text-ivory/80 md:text-3xl">{p.summary}</p>
          ) : null}
          {p.story.length ? (
            <div className="mt-10 max-w-2xl space-y-5 text-[1.0625rem] leading-relaxed text-ivory/70">
              {p.story.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ) : null}
        </header>

        <aside className="lg:col-span-4 lg:col-start-9">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-hairline pt-6 lg:grid-cols-1">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="label text-smoke">{k}</dt>
                <dd className="mt-1 text-ivory">{v}</dd>
              </div>
            ))}
          </dl>
          {p.credits.length ? (
            <div className="mt-10 border-t border-hairline pt-6">
              <h2 className="label mb-4 text-red">Credits</h2>
              <ul className="space-y-2">
                {p.credits.map((c) => (
                  <li key={`${c.role}-${c.name}`} className="flex justify-between gap-6 text-sm">
                    <span className="text-smoke">{c.role}</span>
                    <span className="text-right text-ivory">{c.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      {p.gallery.length ? (
        <section aria-label="Stills" className="container-site pb-20">
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.gallery.map((g, i) => (
              <li key={g.src} className={i % 3 === 0 ? "sm:col-span-2" : undefined}>
                <div className="relative aspect-video overflow-hidden bg-onyx">
                  <Image src={g.src} alt={g.alt} fill sizes="(min-width: 640px) 50vw, 100vw" quality={90} className="object-cover" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {p.next ? (
        <Link
          href={`/work/${p.next.slug}`}
          data-cursor="play"
          className="group relative block overflow-hidden border-t border-hairline"
        >
          <div className="absolute inset-0 opacity-30 transition-opacity duration-700 group-hover:opacity-60">
            <Image src={p.next.cover.src} alt="" fill sizes="100vw" className="object-cover" />
          </div>
          <div className="relative container-site flex items-end justify-between gap-6 py-20 md:py-28">
            <div>
              <p className="label mb-3 text-red">Next film</p>
              <p className="font-serif text-headline text-ivory">{p.next.title}</p>
            </div>
            <span aria-hidden className="mb-3 grid size-12 shrink-0 place-items-center rounded-full border border-hairline text-xl text-ivory transition-colors duration-500 group-hover:border-red group-hover:bg-red">
              →
            </span>
          </div>
        </Link>
      ) : null}

      <JsonLd data={projectJsonLd(p, site)} />
    </article>
  );
}
