import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { YouTubeFilm } from "@/components/media/youtube-film";
import { LabelChip, labelHref } from "@/components/site/label-chip";
import { RelatedWork } from "@/components/site/related-work";
import { projectLayout } from "@/features/content/neighbours";
import { getProject, getProjectSlugs, projectMeta, type ProjectDetail } from "@/features/content/projects";
import { getSite, type WorkItem } from "@/features/content/queries";
import { clockDuration } from "@/features/media/delivery";
import { JsonLd, projectJsonLd } from "@/features/seo/json-ld";
import { shareImages } from "@/features/seo/share-server";
import { cn } from "@/lib/utils";

export async function generateStaticParams() {
  return (await getProjectSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [p, images] = await Promise.all([getProject(slug), shareImages({ kind: "project", slug })]);
  if (!p) return {};
  const { title, description } = projectMeta(p);
  return {
    title,
    description,
    alternates: { canonical: `/work/${p.slug}` },
    openGraph: {
      type: p.film ? "video.other" : "article",
      url: `/work/${p.slug}`,
      title,
      description,
      images: images.openGraph,
      ...(p.film ? { videos: [{ url: p.film.embedUrl, type: "text/html" }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description, images: images.twitter },
  };
}

/**
 * A project page shaped by its film (#30). Landscape films (or none) keep the full-bleed cinematic
 * hero with the text below; portrait reels and square edits get a player in their own shape beside
 * the text, over a blurred, darkened copy of the cover. Both layouts carry the same h1 and text, so the
 * SEO/GEO content is identical. Nothing above the fold uses data-reveal, and nothing is sticky.
 */
export default async function ProjectPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const [p, site] = await Promise.all([getProject(slug), getSite()]);
  if (!p) notFound();
  const layout = projectLayout(p);

  return (
    <article className="bg-ink pt-16 md:pt-20" data-layout={layout}>
      {layout === "portrait" ? <PortraitHero p={p} /> : <LandscapeHero p={p} />}

      {p.gallery.length ? <Gallery p={p} /> : null}

      {p.related.length ? (
        <section aria-labelledby="related-title" className="container-site border-t border-hairline py-16 md:py-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 id="related-title" className="font-serif text-title text-ivory">
              More in <em className="text-red italic">{p.labels[0]?.visible ? p.labels[0].name.toLowerCase() : "work"}</em>
            </h2>
            <Link
              href={p.labels[0]?.visible ? labelHref(p.labels[0].slug) : "/work"}
              className="label link-cut text-smoke hover:text-ivory"
              data-cta="related:all"
            >
              {p.labels[0]?.visible ? `All ${p.labels[0].name.toLowerCase()} →` : "All work →"}
            </Link>
          </div>
          <RelatedWork items={p.related} />
        </section>
      ) : null}

      {p.prev || p.next ? <PrevNext prev={p.prev} next={p.next} /> : null}

      <JsonLd data={projectJsonLd(p, site)} />
    </article>
  );
}

function LandscapeHero({ p }: { p: ProjectDetail }) {
  return (
    <>
      {/* Film (or still) — full-bleed, capped so the title stays near the fold */}
      <div className="relative">
        {p.film ? (
          <YouTubeFilm
            youtubeId={p.film.youtubeId}
            title={p.title}
            duration={p.film.duration}
            aspect={p.film.aspect}
            orientation={p.film.orientation}
            start={p.film.start}
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
        <div className="lg:col-span-7">
          <Intro p={p} />
          <Story p={p} />
        </div>
        <aside data-reveal style={{ ["--i" as string]: 2 }} className="lg:col-span-4 lg:col-start-9">
          <Facts p={p} />
        </aside>
      </div>
    </>
  );
}

/**
 * Portrait reel / square edit: the player at its own aspect (never wider than its box), the info beside
 * it on desktop and below it on phones, with the title peeking under the fold. The backdrop is the
 * cover's tiny blur placeholder (or a 48px render) stretched and blurred: low-entropy, so it is never
 * the LCP element; the poster is.
 */
function PortraitHero({ p }: { p: ProjectDetail }) {
  const film = p.film!;
  const style = { ["--aspect" as string]: film.aspect } as React.CSSProperties;
  return (
    <section aria-label="Film" className="relative isolate overflow-hidden border-b border-hairline">
      <div aria-hidden className="absolute inset-0 -z-10">
        {p.cover.blurDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- inline data URL placeholder, no request
          <img src={p.cover.blurDataUrl} alt="" className="size-full scale-110 object-cover blur-[40px] brightness-[0.35]" />
        ) : (
          <Image src={p.cover.src} alt="" fill sizes="48px" quality={75} className="scale-110 object-cover blur-[40px] brightness-[0.35]" />
        )}
        <span className="absolute inset-0 bg-linear-to-b from-ink/30 via-transparent to-ink" />
      </div>
      <div className="container-site grid items-center gap-8 py-6 md:py-10 lg:grid-cols-12 lg:gap-12 lg:py-14">
        <div className="lg:col-span-5 lg:col-start-2">
          <YouTubeFilm
            youtubeId={film.youtubeId}
            title={p.title}
            duration={film.duration}
            aspect={film.aspect}
            orientation={film.orientation}
            start={film.start}
            poster={p.cover}
            priority
            sizes="(min-width: 1024px) 34vw, 100vw"
            style={style}
            className="mx-auto w-[min(100%,calc(85svh*var(--aspect)))] border border-hairline lg:w-[min(100%,calc(min(82svh,860px)*var(--aspect)))]"
          />
        </div>
        <div className="lg:col-span-5 lg:col-start-7">
          <Intro p={p} compact />
          <div className="mt-8">
            <Facts p={p} />
          </div>
        </div>
      </div>
      {p.story.length || p.transcript ? (
        <div className="container-site pb-14 md:pb-20 lg:grid lg:grid-cols-12">
          <div className="lg:col-span-5 lg:col-start-7">
            <Story p={p} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** Breadcrumb, h1, meta line and summary (same text in both layouts). */
function Intro({ p, compact = false }: { p: ProjectDetail; compact?: boolean }) {
  const primary = p.labels[0];
  const meta = [p.film?.orientation === "portrait" ? "Reel" : p.format, String(p.year), p.film?.duration ? clockDuration(p.film.duration) : undefined]
    .filter(Boolean)
    .join(" · ");
  return (
    <header>
      <nav aria-label="Breadcrumb" className="label mb-6 text-smoke">
        <Link href="/work" className="hit-44 hover:text-ivory">
          Work
        </Link>
        <span aria-hidden className="mx-2 text-red">
          /
        </span>
        {primary?.visible ? <LabelChip label={primary} variant="crumb" /> : p.category}
      </nav>
      <h1 className={cn("font-serif text-ivory [text-wrap:balance]", compact ? "text-headline" : "text-headline")}>{p.title}</h1>
      {compact ? <p className="label mt-4 text-smoke">{meta}</p> : null}
      {p.summary ? (
        <p className={cn("mt-6 max-w-2xl font-serif leading-snug text-ivory/80", compact ? "text-xl md:text-2xl" : "text-2xl md:text-3xl")}>
          {p.summary}
        </p>
      ) : null}
    </header>
  );
}

function Story({ p }: { p: ProjectDetail }) {
  return (
    <>
      {p.story.length ? (
        <div data-reveal className="mt-10 max-w-2xl space-y-5 text-[1.0625rem] leading-relaxed text-ivory/70">
          {p.story.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : null}
      {p.transcript ? (
        <details data-reveal className="group mt-10 max-w-2xl border-t border-hairline pt-6">
          <summary className="label flex cursor-pointer list-none items-center gap-3 text-smoke hover:text-ivory">
            <span className="text-red transition-transform group-open:rotate-90">▸</span> Transcript
          </summary>
          <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-ivory/65">{p.transcript}</p>
        </details>
      ) : null}
    </>
  );
}

/** Client, format, year, role, runtime, labels and credits. */
function Facts({ p }: { p: ProjectDetail }) {
  const facts = [
    ["Client", p.clientName],
    ["Format", p.format],
    ["Year", String(p.year)],
    ["Role", p.role],
    ["Runtime", p.film?.duration ? clockDuration(p.film.duration) : undefined],
  ].filter((f): f is [string, string] => Boolean(f[1]));
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-hairline pt-6 lg:grid-cols-1">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="label text-smoke">{k}</dt>
            <dd className="mt-1 text-ivory">{v}</dd>
          </div>
        ))}
        {p.labels.length ? (
          <div className="col-span-2 lg:col-span-1">
            <dt className="label text-smoke">Labels</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {p.labels.map((l) =>
                l.visible ? (
                  <LabelChip key={l.slug} label={l} />
                ) : (
                  <span key={l.slug} className="label inline-flex h-7 items-center border border-foreground/10 px-2.5 text-smoke">
                    {l.name}
                  </span>
                ),
              )}
            </dd>
          </div>
        ) : null}
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
    </>
  );
}

/**
 * Stills in their own shapes (#30): a masonry of columns (1 / 2 / 3), each image at its stored
 * width × height, so portrait and landscape stills both keep their aspect. Captions from the asset.
 */
function Gallery({ p }: { p: ProjectDetail }) {
  return (
    <section aria-label="Stills" className="container-site pb-20">
      <ul className="columns-1 gap-2 sm:columns-2 lg:columns-3">
        {p.gallery.map((g) => {
          const ratio = g.width && g.height ? g.width / g.height : 16 / 9;
          return (
            <li key={g.src} className="mb-2 break-inside-avoid">
              <figure>
                <div data-reveal="wipe" className="relative overflow-hidden bg-onyx" style={{ aspectRatio: ratio }}>
                  <Image
                    src={g.src}
                    alt={g.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    quality={90}
                    placeholder={g.blurDataUrl ? "blur" : "empty"}
                    blurDataURL={g.blurDataUrl}
                    className="object-cover"
                  />
                </div>
                {g.caption ? <figcaption className="label mt-2 text-smoke">{g.caption}</figcaption> : null}
              </figure>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** ← Previous film | Next film →, in grid order. A reel neighbour shows a 9:16 crop. */
function PrevNext({ prev, next }: { prev?: WorkItem; next?: WorkItem }) {
  return (
    <nav aria-label="More films" className="grid border-t border-hairline md:grid-cols-2">
      {prev ? <Neighbour item={prev} dir="prev" /> : <span className="hidden md:block" />}
      {next ? <Neighbour item={next} dir="next" /> : null}
    </nav>
  );
}

function Neighbour({ item, dir }: { item: WorkItem; dir: "prev" | "next" }) {
  const portrait = item.orientation === "portrait";
  return (
    <Link
      href={`/work/${item.slug}`}
      data-cursor="play"
      data-cta={`project:${dir}`}
      className={cn(
        "group relative flex items-center gap-6 overflow-hidden px-4 py-10 sm:px-6 md:py-14 lg:px-10",
        dir === "next" ? "flex-row-reverse text-right md:border-l md:border-hairline" : "border-b border-hairline md:border-b-0",
      )}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden border border-hairline bg-onyx opacity-70 transition-opacity duration-700 group-hover:opacity-100",
          portrait ? "aspect-[9/16] w-20 md:w-24" : "aspect-video w-36 md:w-48",
        )}
      >
        <Image src={item.cover.src} alt="" fill sizes="192px" quality={75} className="object-cover" />
      </div>
      <div className="min-w-0">
        <p className="label mb-2 text-red">{dir === "prev" ? "← Previous film" : "Next film →"}</p>
        <p className="font-serif text-3xl leading-tight text-ivory md:text-4xl">{item.title}</p>
      </div>
    </Link>
  );
}
