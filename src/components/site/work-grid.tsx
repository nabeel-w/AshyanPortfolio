import Image from "next/image";
import Link from "next/link";
import { isAboveFold } from "@/features/sections/placement";
import type { SectionProps } from "@/features/sections/schemas";
import { VideoLoop } from "@/components/media/video-loop";
import { LabelChip, LabelTags, type ChipLabel } from "./label-chip";
import { WorkFilter } from "./work-filter";
import { cn } from "@/lib/utils";

type Project = SectionProps<"workGrid">["projects"][number];

export type WorkGridProps = SectionProps<"workGrid"> & {
  position?: number;
  /** Label landing pages: that chip is active and the section header is the page's own */
  activeLabel?: string;
  /** Hide the heading row (label pages render their own h1) */
  bare?: boolean;
};

/** Chips for the rail: the hydrated label list, or labels derived from the cards (fallback content). */
function railLabels(labelList: ChipLabel[], projects: Project[]): ChipLabel[] {
  if (labelList.length) return labelList;
  const seen = new Map<string, ChipLabel & { count: number }>();
  for (const p of projects)
    for (const l of p.labels) {
      const hit = seen.get(l.slug);
      if (hit) hit.count++;
      else seen.set(l.slug, { ...l, count: 1 });
    }
  return [...seen.values()];
}

/**
 * Black "screening room" grid: 2 wide + 3 narrow on desktop, 2-up on tablet, 1 column on phones.
 * Label chips are real links (to /work/label/<slug>); on /work they filter in place (WorkFilter).
 * Red is only used for the index number, the active chip and the playhead.
 */
export function WorkGrid({
  label,
  projects,
  labelList,
  chips,
  tone,
  position,
  activeLabel,
  bare,
}: WorkGridProps) {
  const top = isAboveFold(position);
  const rail = railLabels(labelList, projects);
  const filterInPlace = chips === "filter" && !activeLabel;
  const railNav = rail.length ? (
    <nav
      aria-label="Filter work by label"
      className="-mx-4 scrollbar-none overflow-x-auto px-4 mask-r-from-85% md:mx-0 md:px-0 md:mask-none [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max snap-x gap-2 py-2">
        <li>
          <LabelChip
            label={{ name: "All", slug: "all" }}
            href="/work"
            active={filterInPlace}
          />
        </li>
        {rail.map((l) => (
          <li key={l.slug}>
            <LabelChip label={l} active={activeLabel === l.slug} />
          </li>
        ))}
      </ul>
    </nav>
  ) : null;

  return (
    <section
      id="work"
      aria-labelledby={bare ? undefined : "work-title"}
      aria-label={bare ? "Films" : undefined}
      className={cn("scroll-mt-20 py-20 md:py-32", tone === "paper" ? "tone-paper" : "bg-ink", bare && "pt-0 md:pt-0")}
    >
      <div className="container-site">
        <div
          data-reveal={bare ? undefined : ""}
          className="mb-10 flex flex-col gap-6 border-b border-hairline pb-6 md:mb-14 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <p className="label mb-3 text-muted-foreground tabular-nums">
              <span className="text-red">●</span> Reel /{" "}
              <span data-work-count aria-live="polite">
                {String(projects.length).padStart(2, "0")}
              </span>{" "}
              films
            </p>
            {bare ? null : (
              <h2 id="work-title" className="font-serif text-headline">
                {label.split(" ").slice(0, -1).join(" ")}{" "}
                <em className="text-red italic">{label.split(" ").slice(-1)}</em>
              </h2>
            )}
          </div>
          {filterInPlace && railNav ? <WorkFilter>{railNav}</WorkFilter> : railNav}
        </div>

        <ul className="grid grid-cols-1 gap-x-3 gap-y-10 sm:grid-cols-2 md:gap-y-14 lg:grid-cols-6">
          {projects.map((p, i) => (
            <li
              key={p.slug}
              data-labels={p.labels.map((l) => l.slug).join(" ")}
              className={cn(
                i < 2 ? "lg:col-span-3" : "lg:col-span-2",
                i === 4 && "sm:col-span-2 lg:col-span-2",
              )}
            >
              <WorkCard project={p} large={i < 2} index={i} aboveFold={top && i < 2} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Stretched-link card: the title link covers the whole card (one tab stop), label links sit above it
 * (relative z-10), so there are no nested anchors. The hover loop's scope is the article.
 */
function WorkCard({
  project,
  large,
  index,
  aboveFold,
}: {
  project: Project;
  large: boolean;
  index: number;
  aboveFold: boolean;
}) {
  return (
    <article data-loop-scope className="group relative">
      <div
        // Never hide above-the-fold frames behind the wipe: they're the page's LCP.
        data-reveal={aboveFold ? undefined : "wipe"}
        data-cursor="play"
        style={{ ["--i" as string]: index % 3 }}
        className={cn(
          "relative overflow-hidden border border-hairline bg-onyx",
          "aspect-video",
          large ? "lg:aspect-[16/8]" : "lg:aspect-[4/3]",
        )}
      >
        <Image
          src={project.cover.src}
          alt={project.cover.alt}
          fill
          sizes={
            large
              ? "(min-width: 1024px) 50vw, (min-width: 640px) 50vw, 100vw"
              : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          }
          loading={index < 2 ? "eager" : "lazy"}
          preload={aboveFold && index === 0}
          fetchPriority={aboveFold && index === 0 ? "high" : undefined}
          quality={90}
          placeholder={project.cover.blurDataUrl ? "blur" : "empty"}
          blurDataURL={project.cover.blurDataUrl}
          className="object-cover transition-[transform,filter] duration-[1.4s] ease-out-expo group-hover:scale-[1.04] md:brightness-[0.82] md:group-hover:brightness-100"
        />
        {/* Hover (desktop) / in-view (touch) preview loop over the hi-res still */}
        {project.loop ? <VideoLoop src={project.loop.src} /> : null}
        {/* Playhead sweep */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-px bg-red opacity-0 transition-[left,opacity] duration-[1.2s] ease-cut group-hover:left-full group-hover:opacity-100"
        />
      </div>
      <div
        data-reveal
        style={{ ["--i" as string]: (index % 3) + 2 }}
        className="mt-4 flex items-start justify-between gap-4"
      >
        <div className="flex items-baseline gap-3">
          <span className="label text-red tabular-nums">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3 className="font-serif text-2xl leading-tight md:text-3xl">
              <Link
                href={`/work/${project.slug}`}
                className="after:absolute after:inset-0 after:z-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-[var(--signal-red)] focus-visible:after:outline-solid"
              >
                {project.title}
              </Link>
            </h3>
            <p className="label mt-1.5 flex flex-wrap items-center gap-x-2 text-muted-foreground">
              <LabelTags labels={project.labels} className="relative z-10" />
              {project.labels.length ? <span aria-hidden>·</span> : null}
              <span>{project.year}</span>
            </p>
          </div>
        </div>
        <span
          aria-hidden
          className="mt-1 grid size-9 shrink-0 place-items-center rounded-full border border-hairline transition-colors duration-500 group-hover:border-red group-hover:bg-red group-hover:text-ivory"
        >
          →
        </span>
      </div>
    </article>
  );
}
