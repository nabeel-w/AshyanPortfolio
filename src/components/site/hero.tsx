import Image from "next/image";
import type { SectionProps } from "@/features/sections/schemas";
import { RichText } from "./rich-text";
import { Timecode } from "./timecode";

/**
 * Mobile: full-bleed image on top (70svh), headline overlaps the bottom edge.
 * Desktop: full-bleed frame; its own black left half carries the headline.
 * The image is the LCP element → `preload` + `fetchPriority="high"`, no JS needed to paint.
 */
export function Hero({ eyebrow, headline, cta, media }: SectionProps<"hero">) {
  return (
    <section className="relative isolate overflow-hidden bg-ink" aria-labelledby="hero-title">
      <div className="absolute inset-0 -z-10">
        <Image
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          preload
          fetchPriority="high"
          quality={90}
          sizes="100vw"
          className="h-full w-full object-cover object-[80%_center] md:object-right"
        />
        {/* Fade the image into black — left on desktop, bottom on mobile */}
        <div className="absolute inset-0 bg-linear-to-t from-ink via-ink/50 to-ink/10 md:bg-linear-to-r md:from-ink/70 md:via-transparent md:to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-linear-to-t from-ink to-transparent" />
      </div>

      <div className="container-site flex min-h-[92svh] flex-col justify-end pt-28 pb-10 md:min-h-[100svh] md:justify-center md:pb-24">
        <p className="label mb-6 flex items-center gap-3 text-ivory/70">
          <span className="size-1.5 animate-pulse rounded-full bg-red" aria-hidden />
          {eyebrow}
        </p>
        <h1
          id="hero-title"
          className="max-w-[11ch] font-serif text-display text-ivory [text-wrap:balance]"
        >
          <RichText text={headline} />
        </h1>
        <div className="mt-10 flex items-end justify-between gap-6 md:mt-14">
          <a href={cta.href} data-cta="hero" className="link-cut text-ivory">
            {cta.label}
            <span aria-hidden>—</span>
          </a>
          <Timecode className="hidden text-ivory/50 sm:block" />
        </div>
      </div>
    </section>
  );
}
