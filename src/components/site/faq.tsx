import type { SectionProps } from "@/features/sections/schemas";
import { RichText } from "./rich-text";

/**
 * Question-shaped subheads with short answers, all visible (no accordion) so people, search
 * engines and AI assistants read the same text. PublishedPage adds matching FAQPage JSON-LD.
 */
export function Faq({ eyebrow, title, items }: SectionProps<"faq">) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="faq-title" className="border-t border-hairline bg-ink py-20 md:py-32">
      <div className="container-site grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p data-reveal className="label mb-4 text-red">
            {eyebrow}
          </p>
          <h2 data-reveal id="faq-title" className="font-serif text-headline text-ivory">
            <RichText text={title} />
          </h2>
        </div>
        {/* Question headings + answer paragraphs (a <dl> can't hold headings or the number column). */}
        <div className="divide-y divide-hairline border-y border-hairline lg:col-span-7 lg:col-start-6">
          {items.map((item, i) => (
            <div
              key={`${item.question}-${i}`}
              data-reveal
              className="grid gap-3 py-8 md:grid-cols-[3rem_1fr]"
            >
              <span aria-hidden className="label pt-2 text-red tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-serif text-2xl leading-snug text-ivory md:text-3xl">
                  {item.question}
                </h3>
                <p className="mt-3 max-w-2xl leading-relaxed text-ivory/70">{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
