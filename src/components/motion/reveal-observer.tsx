"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * One IntersectionObserver for every `[data-reveal]` element on the page. Each element is revealed
 * once (sets data-revealed) and then unobserved; CSS in globals.css does the animation.
 * Re-scans after client navigations. ~1 KB, no animation library.
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.revealed = "";
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-revealed])").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}

/** Inline, pre-paint: enables reveal styles only when JS runs (no-JS visitors see everything). */
export const enableRevealScript = `document.documentElement.classList.add("js")`;
