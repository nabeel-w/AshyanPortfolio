"use client";

import { useEffect } from "react";

/**
 * Lenis smooth scrolling — desktop (fine pointer + hover) only, never for reduced motion.
 * Loaded lazily so touch devices never download it. Native scroll position is preserved,
 * so CSS scroll-driven effects (header, red scroll streak) keep working.
 */
export function SmoothScroll() {
  useEffect(() => {
    const desktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!desktop || reduced) return;

    let raf = 0;
    let destroyed = false;
    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;

    void import("lenis").then(({ default: Lenis }) => {
      if (destroyed) return;
      lenis = new Lenis({ duration: 1.1, anchors: { offset: -80 }, autoRaf: false });
      const loop = (t: number) => {
        lenis?.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      lenis?.destroy();
    };
  }, []);

  return null;
}
