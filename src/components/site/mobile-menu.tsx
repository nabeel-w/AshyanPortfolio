"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Full-screen serif menu for < md. Large tap targets, closes on navigation and Escape. */
export function MobileMenu({ items, email }: { items: { label: string; href: string }[]; email: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
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
          open && "animate-in fade-in duration-300",
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
                  <span className="label text-red tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <a href={`mailto:${email}`} className="link-cut self-start text-ivory">
          {email}
        </a>
      </div>
    </div>
  );
}
