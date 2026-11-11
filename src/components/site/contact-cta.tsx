import type { SectionProps } from "@/features/sections/schemas";
import { RichText } from "./rich-text";

export function ContactCta({ label, headline, email, note }: SectionProps<"contactCta">) {
  return (
    <section id="contact" aria-labelledby="contact-title" className="scroll-mt-20 bg-ink py-24 md:py-36">
      <div className="container-site text-center">
        <p data-reveal className="label mb-6 text-red">{label}</p>
        <h2 data-reveal style={{ ["--i" as string]: 1 }} id="contact-title" className="mx-auto max-w-4xl font-serif text-headline text-ivory [text-wrap:balance]">
          <RichText text={headline} />
        </h2>
        <a
          href={`mailto:${email}`}
          data-cta="email"
          className="group mt-10 inline-flex min-h-11 items-center gap-4 font-serif text-2xl text-ivory sm:text-3xl md:mt-14"
        >
          <span className="break-all sm:break-normal">{email}</span>
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-hairline transition-colors duration-500 group-hover:border-red group-hover:bg-red">
            <span aria-hidden className="font-sans text-base">→</span>
          </span>
        </a>
        {note ? <p className="label mt-8 text-smoke">{note}</p> : null}
      </div>
    </section>
  );
}
