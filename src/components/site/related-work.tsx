import Image from "next/image";
import Link from "next/link";
import type { WorkItem } from "@/features/content/queries";
import { LabelTags } from "./label-chip";

/**
 * "More in <label>" on project pages (#28): up to three films, each a stretched-link card whose label
 * tags stay separately clickable. Below the fold, so the stills lazy-load.
 */
export function RelatedWork({ items }: { items: WorkItem[] }) {
  return (
    <ul className="grid gap-x-3 gap-y-10 sm:grid-cols-3">
      {items.map((p, i) => (
        <li key={p.slug}>
          <article data-loop-scope className="group relative">
            <div
              data-reveal="wipe"
              data-cursor="play"
              style={{ ["--i" as string]: i }}
              className="relative aspect-video overflow-hidden border border-hairline bg-onyx"
            >
              <Image
                src={p.cover.src}
                alt={p.cover.alt}
                fill
                sizes="(min-width: 640px) 33vw, 100vw"
                quality={75}
                placeholder={p.cover.blurDataUrl ? "blur" : "empty"}
                blurDataURL={p.cover.blurDataUrl}
                className="object-cover transition-[transform,filter] duration-[1.4s] ease-out-expo group-hover:scale-[1.04] md:brightness-[0.82] md:group-hover:brightness-100"
              />
            </div>
            <h3 className="mt-4 font-serif text-2xl leading-tight text-ivory">
              <Link
                href={`/work/${p.slug}`}
                data-cta="related"
                className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-[var(--signal-red)] focus-visible:after:outline-solid"
              >
                {p.title}
              </Link>
            </h3>
            <p className="label mt-1.5 flex flex-wrap items-center gap-x-2 text-muted-foreground">
              <LabelTags labels={p.labels} className="relative z-10" />
              {p.labels.length ? <span aria-hidden>·</span> : null}
              <span>{p.year}</span>
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}
