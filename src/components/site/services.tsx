import type { SectionProps } from "@/features/sections/schemas";
import { RichText } from "./rich-text";

/** "What I do" — numbered service cards, 2-up on desktop. */
export function Services({ eyebrow, title, items }: SectionProps<"services">) {
  return (
    <section aria-labelledby="services-title" className="border-t border-hairline bg-ink py-20 md:py-32">
      <div className="container-site">
        <p data-reveal className="label mb-4 text-red">{eyebrow}</p>
        <h2 data-reveal id="services-title" className="mb-12 font-serif text-headline text-ivory md:mb-16">
          <RichText text={title} />
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((item, i) => (
            <li
              key={`${item.title}-${i}`}
              data-reveal
              style={{ ["--i" as string]: i % 2 }}
              className="group flex flex-col border border-hairline bg-onyx p-6 transition-colors duration-500 hover:border-red/50 md:p-8"
            >
              <span className="label text-red tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-4 font-sans text-lg font-medium tracking-[0.06em] text-ivory uppercase">{item.title}</h3>
              <p className="mt-3 flex-1 leading-relaxed text-ivory/65">{item.description}</p>
              {item.tag ? <p className="label mt-6 text-smoke">{item.tag}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
