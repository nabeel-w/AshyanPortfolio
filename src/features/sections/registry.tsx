import type { ComponentType } from "react";
import { About } from "@/components/site/about";
import { ClientMarquee } from "@/components/site/client-marquee";
import { ContactCta } from "@/components/site/contact-cta";
import { Hero } from "@/components/site/hero";
import { Statement } from "@/components/site/statement";
import { WorkGrid } from "@/components/site/work-grid";
import type { SectionData, SectionProps, SectionType } from "./schemas";

type Registry = { [K in SectionType]: { label: string; component: ComponentType<SectionProps<K>> } };

/** One entry per section type. The admin editor reads `label` for its "Add section" menu. */
export const sectionRegistry: Registry = {
  hero: { label: "Hero", component: Hero },
  clientMarquee: { label: "Client logos", component: ClientMarquee },
  workGrid: { label: "Work grid", component: WorkGrid },
  statement: { label: "Statement", component: Statement },
  about: { label: "About + capabilities", component: About },
  contactCta: { label: "Contact CTA", component: ContactCta },
};

/** Renders a page's sections in order. Used by the public site AND the admin live preview. */
export function SectionRenderer({ sections }: { sections: SectionData[] }) {
  return sections
    .filter((s) => s.visible)
    .map((s) => {
      const Component = sectionRegistry[s.type].component as ComponentType<typeof s.data>;
      return (
        <div key={s.id} data-section-id={s.id} data-section-type={s.type}>
          <Component {...s.data} />
        </div>
      );
    });
}
