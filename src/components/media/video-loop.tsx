"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Only one loop plays at a time across the page. */
let active: HTMLVideoElement | null = null;

function claim(video: HTMLVideoElement) {
  if (active && active !== video) active.pause();
  active = video;
}

/**
 * Muted preview loop (a short MP4/WebM on Vercel Blob) layered over a poster image; the poster stays
 * the LCP element. Portrait loops fill tall bento tiles with object-cover, so no letterboxing.
 * - Bytes load only when the card is near the viewport (preload="none" until then).
 * - Desktop (hover-capable): plays while the surrounding card is hovered or focused.
 * - Touch: plays while ≥ 60% visible.
 * - Never plays for reduced-motion or Save-Data users.
 */
export function VideoLoop({ src: loopSrc, poster, className }: { src: string; poster?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || connection?.saveData) return;

    const hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const scope = video.closest<HTMLElement>("[data-loop-scope]") ?? video.parentElement!;
    const start = () => {
      setSrc((s) => s ?? loopSrc);
      claim(video);
      void video.play().catch(() => {});
    };
    const stop = () => {
      video.pause();
      if (hoverCapable) video.currentTime = 0;
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) setSrc((s) => s ?? loopSrc);
        if (!hoverCapable) {
          if (entry.intersectionRatio >= 0.6) start();
          else stop();
        }
      },
      { rootMargin: "200px", threshold: [0, 0.6] },
    );
    io.observe(video);

    if (hoverCapable) {
      scope.addEventListener("pointerenter", start);
      scope.addEventListener("pointerleave", stop);
      scope.addEventListener("focusin", start);
      scope.addEventListener("focusout", stop);
    }
    return () => {
      io.disconnect();
      scope.removeEventListener("pointerenter", start);
      scope.removeEventListener("pointerleave", stop);
      scope.removeEventListener("focusin", start);
      scope.removeEventListener("focusout", stop);
      if (active === video) active = null;
    };
  }, [loopSrc]);

  return (
    <video
      ref={ref}
      src={src ?? undefined}
      muted
      loop
      playsInline
      preload="none"
      poster={poster}
      aria-hidden
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      className={cn(
        "pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-700",
        playing ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
