"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Category chips for the work grid. Filters the server-rendered cards in place by toggling
 * `hidden` on `[data-category]` items inside the closest section — no re-render, no extra JS bundle.
 */
export function WorkFilter({ categories }: { categories: string[] }) {
  const [active, setActive] = useState(categories[0] ?? "All");

  function select(category: string, el: HTMLElement) {
    setActive(category);
    const section = el.closest("section");
    section?.querySelectorAll<HTMLElement>("[data-category]").forEach((item) => {
      item.hidden = category !== categories[0] && item.dataset.category !== category;
    });
  }

  return (
    <ul className="flex w-max gap-6">
      {categories.map((c) => (
        <li key={c}>
          <button
            type="button"
            aria-pressed={active === c}
            onClick={(e) => select(c, e.currentTarget)}
            className={cn(
              "label relative inline-block min-h-11 py-2 transition-colors",
              active === c
                ? "text-foreground after:absolute after:inset-x-0 after:bottom-1 after:h-px after:bg-red"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        </li>
      ))}
    </ul>
  );
}
