"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SocialIcon } from "./social-icon";

/** Full-screen serif menu for < md. Large tap targets, closes on navigation and Escape. */
export function MobileMenu({
  items,
  email,
  socials = [],
}: {
  items: { label: string; href: string }[];
  email: string;
  socials?: { label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    // Focus trap: everything outside the menu (and its toggle) is inert while it's open,
    // so Tab and screen readers can't wander into the page underneath.
    const inerted: HTMLElement[] = [];
    for (
      let el: HTMLElement | null = root.current;
      el && el !== document.body;
      el = el.parentElement
    ) {
      for (const sibling of Array.from(el.parentElement?.children ?? [])) {
        if (sibling !== el && sibling instanceof HTMLElement && !sibling.inert) {
          sibling.inert = true;
          inerted.push(sibling);
        }
      }
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      for (const el of inerted) el.inert = false;
    };
  }, [open]);

  return (
    <div ref={root} className="md:hidden">
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="label relative z-[60] -mr-3 min-h-11 px-3 text-ivory"
      >
        {open ? "Close" : "Menu"}
      </button>

      <div
        id="mobile-menu"
        hidden={!open}
        className={cn(
          "fixed inset-0 z-50 flex flex-col justify-between bg-ink px-4 pt-24 pb-[max(2rem,env(safe-area-inset-bottom))]",
          open && "animate-in duration-300 fade-in",
        )}
      >
        <nav aria-label="Mobile">
          <ul className="space-y-1">
            {items.map((item, i) => (
              <li key={item.label} className="border-b border-hairline">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-16 items-baseline gap-4 py-3 font-serif text-5xl text-ivory"
                >
                  <span className="label text-red tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <a href={`mailto:${email}`} className="link-cut self-start text-ivory">
            {email}
          </a>
          {socials.length ? (
            <ul className="flex gap-2">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="grid size-11 place-items-center rounded-full border border-hairline text-ivory/80 hover:border-red hover:text-red"
                  >
                    <SocialIcon href={s.href} className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
