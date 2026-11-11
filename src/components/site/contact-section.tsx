import { BrandIcon } from "@/components/icons/brand-icons";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import type { SectionProps } from "@/features/sections/schemas";
import { SITE_URL } from "@/lib/site-url";
import { ContactForm } from "./contact-form";
import { SocialIcon } from "./social-icon";
import { whatsappHref } from "@/lib/whatsapp";

/** Contact details that live in Site settings (not per-section). */
export type SiteContact = {
  name: string;
  email: string;
  whatsapp: string | null;
  whatsappMessage?: string;
  socials: { label: string; href: string }[];
};

/** Mario-style contact page body: enquiry form left, details right. */
export function ContactSection({
  projectTypes,
  submitLabel,
  successMessage,
  location,
  availability,
  bookingUrl,
  askAi,
  site,
}: SectionProps<"contactForm"> & { site?: SiteContact }) {
  const aiPrompt = `Tell me about ${site?.name ?? "Ashyan Zafar"}, the film editor (${SITE_URL}). What kind of projects does he edit, and would he be a good fit for my project?`;

  return (
    <section aria-label="Contact" className="bg-ink pb-24 md:pb-32">
      <div className="container-site grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <ContactForm projectTypes={projectTypes} submitLabel={submitLabel} successMessage={successMessage} />
        </div>

        <aside className="space-y-8 border-hairline lg:col-span-4 lg:col-start-9 lg:border-l lg:pl-10">
          {site?.email ? (
            <Detail label="Email">
              <a href={`mailto:${site.email}`} className="font-serif text-2xl text-ivory hover:text-red">
                {site.email}
              </a>
            </Detail>
          ) : null}
          {site?.whatsapp ? (
            <Detail label="WhatsApp">
              <a
                href={whatsappHref(site.whatsapp, site.whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 font-serif text-2xl text-ivory hover:text-red"
              >
                Chat on WhatsApp <WhatsAppIcon className="size-5" />
              </a>
              <p className="mt-1 text-sm text-smoke">Quick replies · usually within the hour</p>
            </Detail>
          ) : null}
          {bookingUrl ? (
            <Detail label="Book a call">
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="font-serif text-2xl text-ivory hover:text-red">
                Find a time ↗
              </a>
            </Detail>
          ) : null}
          {location ? (
            <Detail label="Location">
              <p className="text-ivory">{location}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-smoke">
                <span className="size-1.5 rounded-full bg-red" aria-hidden /> Available remote worldwide
              </p>
            </Detail>
          ) : null}
          {site?.socials.length ? (
            <Detail label="Social">
              <ul className="divide-y divide-hairline border-y border-hairline">
                {site.socials.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center justify-between gap-3 text-ivory/80 hover:text-red"
                    >
                      <span className="flex items-center gap-3">
                        <SocialIcon href={s.href} className="size-4" />
                        {s.label}
                      </span>
                      <span aria-hidden>↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Detail>
          ) : null}
          {availability ? (
            <div className="border border-hairline bg-onyx p-5">
              <p className="label flex items-center gap-2 text-red">
                <span className="size-1.5 animate-pulse rounded-full bg-red" aria-hidden /> Available
              </p>
              <p className="mt-2 text-sm text-ivory/70">{availability}</p>
            </div>
          ) : null}
          {askAi ? (
            <div className="border border-hairline bg-onyx p-5">
              <p className="font-serif text-2xl text-ivory">Not sure I&apos;m the right fit?</p>
              <p className="mt-1 text-sm text-smoke">Ask an AI assistant about my work — the prompt is ready.</p>
              <a
                href={`https://chatgpt.com/?q=${encodeURIComponent(aiPrompt)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="label mt-4 inline-flex min-h-10 items-center gap-2 border border-hairline px-4 text-ivory hover:border-red hover:text-red"
              >
                <BrandIcon brand="chatgpt" className="size-4" /> Ask ChatGPT ↗
              </a>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label mb-2 text-smoke">{label}</p>
      {children}
    </div>
  );
}
