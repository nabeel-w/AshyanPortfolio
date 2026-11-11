import type { SectionProps } from "@/features/sections/schemas";
import { RichText } from "./rich-text";

/** Grouped client names, set as one flowing line per group with red separators. */
export function ClientList({ eyebrow, title, groups }: SectionProps<"clientList">) {
  return (
    <section
      aria-labelledby="clients-title"
      className="border-t border-hairline bg-ink py-20 md:py-32"
    >
      <div className="container-site">
        <p data-reveal className="label mb-4 text-red">
          {eyebrow}
        </p>
        <h2
          data-reveal
          id="clients-title"
          className="mb-12 font-serif text-headline text-ivory md:mb-16"
        >
          <RichText text={title} />
        </h2>
        <div className="space-y-12">
          {groups.map((g) => (
            <div
              key={g.label}
              data-reveal
              className="grid gap-4 border-t border-hairline pt-6 md:grid-cols-12"
            >
              <h3 className="label text-smoke md:col-span-3">{g.label}</h3>
              <p className="leading-loose text-ivory/75 md:col-span-9">
                {g.names.map((name, i) => (
                  <span key={`${name}-${i}`}>
                    <span className="whitespace-nowrap">
                      {name}
                      {i < g.names.length - 1 ? (
                        <span aria-hidden className="ml-2 text-red/70">
                          ·
                        </span>
                      ) : null}
                    </span>{" "}
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
