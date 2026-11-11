import Image from "next/image";
import Link from "next/link";
import type { SectionProps } from "@/features/sections/schemas";
import { VideoLoop } from "@/components/media/video-loop";
import { WorkFilter } from "./work-filter";
import { cn } from "@/lib/utils";

type Project = SectionProps<"workGrid">["projects"][number];

/**
 * Black "screening room" grid: 2 wide + 3 narrow on desktop, 2-up on tablet, 1 column on phones.
 * Frames sit on ink with hairline borders; titles live BELOW the frame (serif + mono meta),
 * so the imagery stays clean. Red is only used for the index number, active filter and playhead.
 */
export function WorkGrid({ label, categories, projects, tone }: SectionProps<"workGrid">) {
  return (
    <section
      id="work"
      aria-labelledby="work-title"
      className={cn("scroll-mt-20 py-20 md:py-32", tone === "paper" ? "tone-paper" : "bg-ink")}
    >
      <div className="container-site">
        <div className="mb-10 flex flex-col gap-6 border-b border-hairline pb-6 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="label mb-3 text-muted-foreground tabular-nums">
              <span className="text-red">●</span> Reel / {String(projects.length).padStart(2, "0")} films
            </p>
            <h2 id="work-title" className="font-serif text-headline">
              {label.split(" ").slice(0, -1).join(" ")}{" "}
              <em className="text-red italic">{label.split(" ").slice(-1)}</em>
            </h2>
          </div>
          {/* Horizontal-scroll chips on mobile, inline on desktop */}
          <nav
            aria-label="Filter work"
            className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
          >
            <WorkFilter categories={categories} />
          </nav>
        </div>

        <ul className="grid grid-cols-1 gap-x-3 gap-y-10 sm:grid-cols-2 md:gap-y-14 lg:grid-cols-6">
          {projects.map((p, i) => (
            <li
              key={p.slug}
              data-category={p.category}
              className={cn(i < 2 ? "lg:col-span-3" : "lg:col-span-2", i === 4 && "sm:col-span-2 lg:col-span-2")}
            >
              <WorkCard project={p} large={i < 2} index={i} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function WorkCard({ project, large, index }: { project: Project; large: boolean; index: number }) {
  return (
    <Link href={`/work/${project.slug}`} data-cursor="play" className="group block">
      <div
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
          quality={90}
          placeholder={project.cover.blurDataUrl ? "blur" : "empty"}
          blurDataURL={project.cover.blurDataUrl}
          className="object-cover transition-[transform,filter] duration-[1.4s] ease-out-expo group-hover:scale-[1.04] md:brightness-[0.82] md:group-hover:brightness-100"
        />
        {/* Hover (desktop) / in-view (touch) preview loop over the hi-res still */}
        {project.loopPlaybackId ? <VideoLoop playbackId={project.loopPlaybackId} /> : null}
        {/* Playhead sweep */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-px bg-red opacity-0 transition-[left,opacity] duration-[1.2s] ease-cut group-hover:left-full group-hover:opacity-100"
        />
        <span className="label absolute top-3 right-3 bg-ink/70 px-2 py-1 text-ivory/80 backdrop-blur-sm">
          {project.category}
        </span>
      </div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="label text-red tabular-nums">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3 className="font-serif text-2xl leading-tight md:text-3xl">{project.title}</h3>
            <p className="label mt-1.5 text-muted-foreground">
              {project.format} · {project.year}
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
    </Link>
  );
}
