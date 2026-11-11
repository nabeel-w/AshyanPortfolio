"use client";

import { useEffect, useState } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { cn } from "@/lib/utils";

/** Build a wa.me deep link: digits only, optional prefilled message. */
export function whatsappHref(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

/**
 * Floating WhatsApp CTA (Mario Monteiro pattern, our palette): a red circle with a soft ping ring,
 * scale on hover, and a mono "WhatsApp" pill that slides in on desktop. It stays out of the way over
 * the hero and fades in once the visitor scrolls. Bottom offset respects the iOS safe area.
 */
export function WhatsAppButton({ phone, message }: { phone: string; message?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <a
      href={whatsappHref(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with Ashyan on WhatsApp"
      data-cta="whatsapp"
      className={cn(
        "group fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-60 flex items-center gap-3 md:right-8 md:bottom-8",
        "transition-[opacity,translate] duration-500 ease-out-expo",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <span className="label pointer-events-none hidden -translate-x-2 items-center gap-2 rounded-full border border-hairline bg-onyx/90 px-3 py-1.5 text-ivory opacity-0 backdrop-blur-sm transition-all duration-500 select-none group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 md:flex">
        <span className="size-1.5 rounded-full bg-red" aria-hidden />
        WhatsApp
      </span>
      <span className="relative grid size-14 place-items-center rounded-full bg-red text-ivory shadow-lg shadow-red/25 transition-all duration-500 group-hover:scale-110 group-hover:bg-red-bright group-hover:shadow-xl group-hover:shadow-red/40">
        <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-red opacity-20 motion-reduce:hidden" />
        <WhatsAppIcon className="relative size-6" />
      </span>
    </a>
  );
}
