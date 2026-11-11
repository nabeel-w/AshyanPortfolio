import Image from "next/image";
import type { SectionProps } from "@/features/sections/schemas";

/**
 * Nick Clement-style rotating client logos: dark square tiles, mono-white marks, slow endless drift.
 * Pure CSS animation (no JS). The list is rendered twice and translated -50% for a seamless loop.
 * Pauses on hover; reduced-motion users get a static, scrollable row.
 */
export function ClientMarquee({ label, speed, clients }: SectionProps<"clientMarquee">) {
  if (!clients.length) return null;
  const loop = [...clients, ...clients];

  return (
    <section aria-label={label} className="border-y border-hairline bg-ink py-6 md:py-8">
      <div className="container-site mb-4 flex items-center justify-between md:mb-5">
        <p className="label text-smoke">{label}</p>
        <p className="label text-smoke tabular-nums">{String(clients.length).padStart(2, "0")} Clients</p>
      </div>
      <div className="group relative overflow-hidden mask-x-from-90% mask-x-to-100% motion-reduce:overflow-x-auto">
        <ul
          className="marquee flex w-max gap-2 group-hover:[animation-play-state:paused] md:gap-3"
          style={{ ["--marquee-duration" as string]: `${speed}s` }}
        >
          {loop.map((client, i) => (
            <li
              key={`${client.name}-${i}`}
              aria-hidden={i >= clients.length}
              className="flex h-16 w-28 shrink-0 items-center justify-center rounded-md bg-onyx px-4 transition-colors duration-500 hover:bg-graphite sm:h-20 sm:w-36 md:h-24 md:w-44"
            >
              {client.logo ? (
                <Image
                  src={client.logo.src}
                  alt={client.name}
                  width={client.logo.width ?? 120}
                  height={client.logo.height ?? 40}
                  className="max-h-7 w-auto opacity-70 brightness-0 invert transition-opacity group-hover:opacity-100"
                />
              ) : (
                <span className="font-sans text-sm font-semibold tracking-[0.14em] text-ivory/70 uppercase sm:text-base">
                  {client.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
