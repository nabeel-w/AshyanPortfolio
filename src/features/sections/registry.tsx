import type { ComponentType } from "react";
import { About } from "@/components/site/about";
import { Bio } from "@/components/site/bio";
import { ClientList } from "@/components/site/client-list";
import { ClientMarquee } from "@/components/site/client-marquee";
import { ContactCta } from "@/components/site/contact-cta";
import { ContactSection, type SiteContact } from "@/components/site/contact-section";
import { Hero } from "@/components/site/hero";
import { PageHeader } from "@/components/site/page-header";
import { Services } from "@/components/site/services";
import { Statement } from "@/components/site/statement";
import { WorkGrid } from "@/components/site/work-grid";
import type { SectionData, SectionProps, SectionType } from "./schemas";

type Registry = {
  [K in SectionType]: {
    label: string;
    description: string;
    component: ComponentType<SectionProps<K> & { site?: SiteContact }>;
  };
};

/** One entry per section type. The admin editor reads `label`/`description` for its "Add section" menu. */
export const sectionRegistry: Registry = {
  hero: { label: "Hero", description: "Full-screen opener with headline and image", component: Hero },
  pageHeader: { label: "Page header", description: "Eyebrow, big title and intro for inner pages", component: PageHeader },
  clientMarquee: { label: "Client logos", description: "Rotating logo strip (logos come from Clients)", component: ClientMarquee },
  workGrid: { label: "Work grid", description: "Films grid with filters (projects come from Projects)", component: WorkGrid },
  statement: { label: "Statement", description: "Mixed serif / caps manifesto line", component: Statement },
  about: { label: "About + capabilities", description: "Image, short bio and capabilities list", component: About },
  bio: { label: "Biography", description: "Portrait, key numbers and long bio", component: Bio },
  services: { label: "Services", description: "Numbered “What I do” cards", component: Services },
  clientList: { label: "Client list", description: "Grouped client names (brands, agencies…)", component: ClientList },
  contactCta: { label: "Contact CTA", description: "“Let's talk” block with email", component: ContactCta },
  contactForm: { label: "Contact form", description: "Enquiry form with contact details", component: ContactSection },
};

/** Renders a page's sections in order. Used by the public site AND the admin live preview. */
export function SectionRenderer({ sections, site }: { sections: SectionData[]; site?: SiteContact }) {
  return sections
    .filter((s) => s.visible)
    .map((s) => {
      const Component = sectionRegistry[s.type].component as ComponentType<typeof s.data & { site?: SiteContact }>;
      return (
        <div key={s.id} data-section-id={s.id} data-section-type={s.type}>
          <Component {...s.data} site={site} />
        </div>
      );
    });
}
