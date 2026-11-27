import Image from "next/image";
import Link from "next/link";
import { tileClass, tilesFor, tileSizes, tileTitle, type Tile } from "@/features/sections/bento";
import { isAboveFold } from "@/features/sections/placement";
import type { SectionProps } from "@/features/sections/schemas";
import { VideoLoop } from "@/components/media/video-loop";
import { LabelChip, LabelTags, type ChipLabel } from "./label-chip";
import { WorkFilter } from "./work-filter";
import { cn } from "@/lib/utils";

type Project = SectionProps<"workGrid">["projects"][number];

export type WorkGridProps = SectionProps<"workGrid"> & {
  position?: number;
  /** Label landing pages: that chip is active */
  activeLabel?: string;
  /** No heading row (label pages render their own h1) */
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
 * Bento "screening room" (#29): landscape films and portrait reels side by side, each in a tile of its
 * own shape (features/sections/bento.ts). Meta sits over the frame on an ink gradient. Label chips are
 * real links; on /work they filter in place (WorkFilter). Red only for the index, active chip, playhead.
 */
export function WorkGrid({
  label,
  projects: all,
  labelList,
  chips,
  limit,
  tone,
  position,
  activeLabel,
  bare,
}: WorkGridProps) {
  const top = isAboveFold(position);
  const filterInPlace = chips === "filter" && !activeLabel;
  // The home teaser shows `limit` films; /work and label pages show everything.
  const projects = limit && !filterInPlace ? all.slice(0, limit) : all;
  const more = all.length > projects.length;
  const tiles = tilesFor(projects);
  const rail = railLabels(labelList, all);

  const railNav = rail.length ? (
    <nav
      aria-label="Filter work by label"
      className="-mx-4 scrollbar-none overflow-x-auto px-4 mask-r-from-85% md:mx-0 md:px-0 md:mask-none [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex w-max snap-x gap-2 py-2">
        <li>
          <LabelChip label={{ name: "All", slug: "all" }} href="/work" active={filterInPlace} />
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

        <div className="bento-scope">
          <ul className="bento">
            {projects.map((p, i) => (
              <li key={p.slug} data-labels={p.labels.map((l) => l.slug).join(" ")} className={cn("min-w-0", tileClass[tiles[i]!])}>
                <WorkTile project={p} tile={tiles[i]!} index={i} aboveFold={top && i === 0} />
              </li>
            ))}
            {filterInPlace ? (
              // Shown by WorkFilter when a label leaves only one or two films, so the grid never looks broken.
              <li data-work-empty hidden className="col-span-2 grid place-items-center border border-dashed border-hairline p-6 text-center">
                <p className="font-serif text-2xl text-foreground/80 md:text-3xl">
                  More <em className="text-red italic" data-work-empty-label /> coming.
                  <span className="mt-3 block">
                    <Link href="/work" data-label-chip="all" className="label link-cut text-muted-foreground hover:text-foreground">
                      See all work →
                    </Link>
                  </span>
                </p>
              </li>
            ) : null}
          </ul>
        </div>

        {more ? (
          <p className="mt-10 text-right">
            <Link href="/work" className="label link-cut text-muted-foreground hover:text-foreground" data-cta="work:all">
              All work · {String(all.length).padStart(2, "0")} films →
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One bento tile. Stretched-link card: the title link covers the tile (one tab stop) and the label
 * links sit above it (relative z-10), so there are no nested anchors. The article is the loop's scope.
 */
function WorkTile({ project, tile, index, aboveFold }: { project: Project; tile: Tile; index: number; aboveFold: boolean }) {
  return (
    <article data-loop-scope data-tile={tile} className="group relative size-full">
      <div
        // Never hide the above-the-fold first tile behind the wipe: it's the page's LCP.
        data-reveal={aboveFold ? undefined : "wipe"}
        data-cursor="play"
        style={{ ["--i" as string]: index % 4 }}
        className="relative size-full overflow-hidden border border-hairline bg-onyx"
      >
        <Image
          src={project.cover.src}
          alt={project.cover.alt}
          fill
          sizes={tileSizes[tile]}
          loading={index < 3 ? "eager" : "lazy"}
          preload={aboveFold}
          fetchPriority={aboveFold ? "high" : undefined}
          quality={90}
          placeholder={project.cover.blurDataUrl ? "blur" : "empty"}
          blurDataURL={project.cover.blurDataUrl}
          className="object-cover transition-[transform,filter] duration-[1.4s] ease-out-expo group-hover:scale-[1.04] md:brightness-[0.82] md:group-hover:brightness-100"
        />
        {/* Hover (desktop) / in-view (touch) preview loop, in the tile's own orientation */}
        {project.loop ? <VideoLoop src={project.loop.src} /> : null}
        {/* Playhead sweep */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-px bg-red opacity-0 transition-[left,opacity] duration-[1.2s] ease-cut group-hover:left-full group-hover:opacity-100"
        />
        {/* Ink gradient keeps the overlaid meta readable (AA) on any still */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-ink/95 via-ink/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 text-ivory md:p-5">
          <div className="min-w-0">
            <p className="flex items-baseline gap-2.5">
              <span className="label text-red tabular-nums" data-work-index>
                {String(index + 1).padStart(2, "0")}
              </span>
            </p>
            <h3 className={cn("mt-1 font-serif leading-[1.02] [text-wrap:balance]", tileTitle[tile])}>
              <Link
                href={`/work/${project.slug}`}
                className="after:absolute after:inset-0 after:z-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-[var(--signal-red)] focus-visible:after:outline-solid"
              >
                {project.title}
              </Link>
            </h3>
            <p className="label mt-2 flex flex-wrap items-center gap-x-2 text-ivory/70">
              <LabelTags labels={project.labels} className="relative z-10 [&_a]:text-ivory/70 [&_a:hover]:text-ivory" />
              {project.labels.length ? <span aria-hidden>·</span> : null}
              <span>{project.year}</span>
            </p>
          </div>
          <span
            aria-hidden
            className="hidden size-9 shrink-0 place-items-center rounded-full border border-ivory/30 transition-colors duration-500 group-hover:border-red group-hover:bg-red sm:grid"
          >
            →
          </span>
        </div>
      </div>
    </article>
  );
}
