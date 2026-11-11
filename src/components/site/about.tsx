import Image from "next/image";
import type { SectionProps } from "@/features/sections/schemas";
import { cn } from "@/lib/utils";
import { RichText } from "./rich-text";

/** Moodboard bottom row: image | about | capabilities. Stacks on mobile, 2-col on tablet. */
export function About({ media, heading, body, capabilities, cta, tone }: SectionProps<"about">) {
  return (
    <section
      id="about"
      aria-labelledby="about-title"
      className={cn("scroll-mt-20", tone === "paper" ? "tone-paper" : "bg-ink")}
    >
      <div className="grid md:grid-cols-2 lg:grid-cols-[1.1fr_1.2fr_0.8fr]">
        <div data-reveal="wipe" className="relative aspect-[4/3] md:row-span-2 md:aspect-auto lg:row-span-1">
          <Image
            src={media.src}
            alt={media.alt}
            fill
            sizes="(min-width: 1024px) 35vw, (min-width: 768px) 50vw, 100vw"
            quality={85}
            className="object-cover"
          />
        </div>
        <div data-reveal style={{ ["--i" as string]: 1 }} className="px-4 py-12 sm:px-6 md:px-10 lg:py-16">
          <p className="label mb-5 text-muted-foreground">About</p>
          <h2 id="about-title" className="font-serif text-title [text-wrap:balance]">
            <RichText text={heading} />
          </h2>
          <p className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">{body}</p>
          <a href={cta.href} data-cta="about" className="link-cut mt-8">
            {cta.label} <span aria-hidden>—</span>
          </a>
        </div>
        <div data-reveal style={{ ["--i" as string]: 2 }} className="border-t border-hairline px-4 py-12 sm:px-6 md:px-10 lg:border-t-0 lg:border-l lg:py-16">
          <p className="label mb-5 text-muted-foreground">Capabilities</p>
          <ul className="space-y-2">
            {capabilities.map((c, i) => (
              <li key={c} className="flex items-baseline gap-4 font-serif text-2xl">
                <span className="label text-red tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
