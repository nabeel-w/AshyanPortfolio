import type { SectionProps } from "@/features/sections/schemas";
import { RichText } from "./rich-text";

/** Mixed serif / italic / sans-caps manifesto line (Mario Monteiro structure, our type + colour). */
export function Statement({ text }: SectionProps<"statement">) {
  return (
    <section aria-label="Statement" className="bg-ink py-24 md:py-40">
      <div className="container-site">
        <p className="mx-auto max-w-5xl text-center font-serif text-headline text-ivory [text-wrap:balance]">
          <RichText text={text} />
        </p>
      </div>
    </section>
  );
}
