import Image from "next/image";
import { isAboveFold } from "@/features/sections/placement";
import type { SectionProps } from "@/features/sections/schemas";

/** Portrait + key numbers + bio paragraphs. */
export function Bio({ media, stats, body, position }: SectionProps<"bio"> & { position?: number }) {
  const top = isAboveFold(position);
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <section aria-label="Biography" className="bg-ink pb-20 md:pb-32">
      <div className="container-site grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <div>
            <div
              data-reveal={top ? undefined : "wipe"}
              className="relative aspect-4/5 overflow-hidden border border-hairline"
            >
              <Image
                src={media.src}
                alt={media.alt}
                fill
                loading="eager"
                preload={top}
                fetchPriority={top ? "high" : undefined}
                quality={90}
                sizes="(min-width: 1024px) 40vw, 100vw"
                placeholder={media.blurDataUrl ? "blur" : "empty"}
                blurDataURL={media.blurDataUrl}
                className="object-cover"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-3 border border-red/40"
              />
            </div>
          </div>
        </div>
        <div className="lg:col-span-7">
          {stats.length ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-8 border-b border-hairline pb-10 sm:grid-cols-4">
              {stats.map((s, i) => (
                <div
                  key={`${s.label}-${i}`}
                  data-reveal
                  style={{ ["--i" as string]: i }}
                  className="flex flex-col-reverse gap-2"
                >
                  <dt className="label text-smoke">{s.label}</dt>
                  <dd
                    className={`font-serif text-5xl md:text-6xl ${i === 0 ? "text-red" : "text-ivory"}`}
                  >
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div
            data-reveal
            className="mt-10 max-w-2xl space-y-5 text-[1.0625rem] leading-relaxed text-ivory/75"
          >
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
