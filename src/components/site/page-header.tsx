import type { SectionProps } from "@/features/sections/schemas";
import { RichText } from "./rich-text";

/** Inner-page opener: red mono eyebrow, big serif title with an italic accent, intro, red rule. */
export function PageHeader({ eyebrow, title, intro }: SectionProps<"pageHeader">) {
  return (
    <header className="bg-ink pt-32 pb-14 md:pt-44 md:pb-20">
      <div className="container-site">
        <p className="label mb-6 text-red">{eyebrow}</p>
        <h1 className="max-w-5xl font-serif text-display text-ivory [text-wrap:balance]">
          <RichText text={title} />
        </h1>
        <span aria-hidden className="mt-10 block h-px w-16 bg-red" />
        {intro ? (
          <p className="mt-8 max-w-xl text-[1.0625rem] leading-relaxed whitespace-pre-line text-ivory/70">{intro}</p>
        ) : null}
      </div>
    </header>
  );
}
