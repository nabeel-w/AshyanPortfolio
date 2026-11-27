"use client";

import { useEffect, useRef } from "react";

/**
 * In-place filtering for /work (#28). The chips are server-rendered <a href="/work/label/…"> links, so
 * without JS (and on every other page) they simply navigate. On /work this island intercepts the click,
 * filters the server-rendered cards by toggling `hidden` on [data-labels] items, updates the count and
 * the URL (?label=<slug>, pushState so Back works), and keeps the active chip in view. No re-render, and
 * the analytics pageview isn't sent again (it keys on the pathname).
 */
export function WorkFilter({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    const section = root?.closest("section");
    if (!root || !section) return;

    const apply = (slug: string | null, scroll: boolean) => {
      const known = slug && root.querySelector(`[data-label-chip="${CSS.escape(slug)}"]`) ? slug : null;
      let shown = 0;
      section.querySelectorAll<HTMLElement>("[data-labels]").forEach((item) => {
        const match = !known || (item.dataset.labels ?? "").split(" ").includes(known);
        item.hidden = !match;
        if (match) {
          shown++;
          // Number the visible films 01, 02… so a filtered grid doesn't start at 03.
          const index = item.querySelector<HTMLElement>("[data-work-index]");
          if (index) index.textContent = String(shown).padStart(2, "0");
        }
      });
      root.querySelectorAll<HTMLAnchorElement>("[data-label-chip]").forEach((a) => {
        const active = a.dataset.labelChip === (known ?? "all");
        if (active) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
        // Bring the active chip into the rail's view (horizontal only: never scroll the page).
        if (active && scroll) {
          const rail = a.closest("nav");
          if (rail && rail.scrollWidth > rail.clientWidth) {
            rail.scrollLeft = Math.max(0, a.offsetLeft - (rail.clientWidth - a.offsetWidth) / 2);
          }
        }
      });
      const count = section.querySelector<HTMLElement>("[data-work-count]");
      if (count) count.textContent = String(shown).padStart(2, "0");
      const empty = section.querySelector<HTMLElement>("[data-work-empty]");
      if (empty) {
        empty.hidden = !known || shown > 2;
        const name = empty.querySelector<HTMLElement>("[data-work-empty-label]");
        const chip = known ? root.querySelector<HTMLElement>(`[data-label-chip="${CSS.escape(known)}"]`) : null;
        if (name && chip) name.textContent = (chip.querySelector("[data-chip-name]")?.textContent ?? "").trim().toLowerCase();
      }
      section.dataset.activeLabel = known ?? "";
      return known;
    };

    const fromUrl = () => new URLSearchParams(window.location.search).get("label");
    apply(fromUrl(), true);

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-label-chip]");
      if (!a || !root.contains(a)) return;
      e.preventDefault();
      const slug = a.dataset.labelChip === "all" ? null : a.dataset.labelChip!;
      const known = apply(slug, true);
      const url = new URL(window.location.href);
      if (known) url.searchParams.set("label", known);
      else url.searchParams.delete("label");
      if (url.href !== window.location.href) window.history.pushState(window.history.state, "", url);
    };
    const onPop = () => apply(fromUrl(), false);

    root.addEventListener("click", onClick);
    window.addEventListener("popstate", onPop);
    return () => {
      root.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  return (
    <div ref={ref} data-work-filter>
      {children}
    </div>
  );
}
