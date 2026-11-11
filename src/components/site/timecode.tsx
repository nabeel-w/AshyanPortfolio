"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Running SMPTE timecode (HH:MM:SS:FF @ 24fps). Writes to the DOM directly — zero React re-renders. */
export function Timecode({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let raf = 0;
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = (now: number) => {
      const frames = Math.floor(((now - start) / 1000) * 24);
      const f = frames % 24;
      const s = Math.floor(frames / 24) % 60;
      const m = Math.floor(frames / 1440) % 60;
      const h = Math.floor(frames / 86400);
      if (ref.current) ref.current.textContent = `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span className={cn("label tabular-nums", className)} aria-hidden>
      <span className="mr-3 text-red">● REC</span>
      <span ref={ref}>00:00:00:00</span>
    </span>
  );
}
