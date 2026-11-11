"use client";

import { useLayoutEffect } from "react";

/**
 * Companion to <Intro>: skip on click / key / wheel / touch, mark the intro done when it ends, and
 * keep it hidden on client-side navigations back to the home page.
 */
export function IntroController() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const overlay = document.querySelector<HTMLElement>("[data-intro-overlay]");
    if (!overlay) return;

    // Client navigation to "/" (the inline script didn't run): play only if never seen this session.
    if (!root.dataset.intro) {
      let seen = true;
      try {
        seen = Boolean(sessionStorage.getItem("az-intro"));
        sessionStorage.setItem("az-intro", "1");
      } catch {}
      root.dataset.intro = seen ? "seen" : "play";
    }
    if (root.dataset.intro !== "play") return;

    const finish = () => {
      root.dataset.intro = "done";
      cleanup();
    };
    const skip = () => {
      if (root.dataset.intro !== "play") return;
      root.dataset.intro = "skip";
      window.setTimeout(finish, 260);
    };
    const onEnd = (e: AnimationEvent) => {
      if (e.target === overlay && e.animationName === "intro-out") finish();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((ev) => window.addEventListener(ev, skip, { passive: true, once: true }));
    overlay.addEventListener("animationend", onEnd);
    // Safety net in case animations are disabled or throttled (background tab).
    const fallback = window.setTimeout(finish, 2500);

    function cleanup() {
      events.forEach((ev) => window.removeEventListener(ev, skip));
      overlay?.removeEventListener("animationend", onEnd);
      window.clearTimeout(fallback);
    }
    return cleanup;
  }, []);

  return null;
}
