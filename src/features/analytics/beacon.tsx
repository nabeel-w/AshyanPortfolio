"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { clickEvent, track } from "./track";

let lastPath: string | null = null;

/** Cookieless pageview + click tracking for the public site (docs/04). Renders nothing. */
export function AnalyticsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    // Guards against React's dev double-effect and same-path re-renders.
    if (lastPath === pathname) return;
    lastPath = pathname;
    track("PAGEVIEW");
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const hit = clickEvent(e.target instanceof Element ? e.target : null, location.origin);
      if (hit) track(hit.t, { l: hit.l });
    };
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
