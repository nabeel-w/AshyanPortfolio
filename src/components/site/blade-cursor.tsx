"use client";

import { useEffect, useRef } from "react";

/**
 * The "blade" cursor (client brief: Zylitch-style custom cursor, but a blade instead of a square).
 * - Scalpel/razor silhouette, tip = hotspot. Tilts with horizontal velocity like a hand-held blade.
 * - Click = "cut": a red hairline slash appears and splits apart.
 * - Over [data-cursor="play"] it grows a ring + PLAY label.
 * - Only on fine pointers, never on touch; disabled for reduced-motion.
 * Perf: one rAF loop, transform-only writes, no React state, sleeps when the mouse is idle.
 */
export function BladeCursor() {
  const bladeRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const blade = bladeRef.current!;
    const ring = ringRef.current!;
    document.documentElement.dataset.cursor = "blade";

    const target = { x: -100, y: -100 };
    const pos = { x: -100, y: -100 };
    let tilt = 0;
    let raf = 0;
    let running = false;
    let hovering = false;

    const loop = () => {
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      pos.x += dx * 0.35;
      pos.y += dy * 0.35;
      tilt += (Math.max(-28, Math.min(28, dx * 0.9)) - tilt) * 0.18;

      blade.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) rotate(${tilt}deg)`;
      ring.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${hovering ? 1 : 0})`;

      if (Math.abs(dx) + Math.abs(dy) + Math.abs(tilt) > 0.15) {
        raf = requestAnimationFrame(loop);
      } else {
        running = false;
      }
    };
    const wake = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      const el = (e.target as Element | null)?.closest?.("[data-cursor]");
      const next = el?.getAttribute("data-cursor") === "play";
      if (next !== hovering) {
        hovering = next;
        ring.dataset.active = String(hovering);
      }
      blade.style.opacity = "1";
      wake();
    };

    const onDown = (e: PointerEvent) => {
      const cut = document.createElement("span");
      cut.className = "blade-cut";
      cut.style.left = `${e.clientX}px`;
      cut.style.top = `${e.clientY}px`;
      cut.style.setProperty("--angle", `${-35 + tilt}deg`);
      document.body.appendChild(cut);
      cut.addEventListener("animationend", () => cut.remove(), { once: true });
    };

    const onLeave = () => (blade.style.opacity = "0");

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      delete document.documentElement.dataset.cursor;
    };
  }, []);

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden
        style={{ transform: "translate3d(-100px, -100px, 0) scale(0)" }}
        className="blade-ring pointer-events-none fixed top-0 left-0 z-[100] hidden [@media(pointer:fine)]:block"
      >
        <span>Play</span>
      </div>
      <div
        ref={bladeRef}
        aria-hidden
        style={{ opacity: 0 }}
        className="pointer-events-none fixed top-0 left-0 z-[101] hidden transition-opacity duration-300 will-change-transform [@media(pointer:fine)]:block"
      >
        {/* Tip sits at (0,0); the blade extends down-right like a scalpel held at 45°. */}
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" className="drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]">
          {/* blade */}
          <path d="M0.5 0.5 L14 9 L18.5 13.5 L13.5 18.5 L9 14 Z" fill="#f4f1ec" />
          {/* cutting edge highlight */}
          <path d="M0.5 0.5 L9 14" stroke="#c1121f" strokeWidth="1.2" strokeLinecap="round" />
          {/* handle */}
          <path d="M16 16 L31 31" stroke="#f4f1ec" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M16 16 L31 31" stroke="#0a0a0a" strokeWidth="1" strokeLinecap="round" strokeDasharray="1.5 3" />
        </svg>
      </div>
    </>
  );
}
