"use client";

import { useEffect, useState } from "react";
import type { SiteContact } from "@/components/site/contact-section";
import { SectionRenderer } from "@/features/sections/registry";
import type { SectionData } from "@/features/sections/schemas";

export type PreviewMessage =
  | { type: "az:preview:update"; id: string; data: unknown }
  | { type: "az:preview:focus"; id: string };

/**
 * Receives draft edits from the editor (same-origin postMessage only) and re-renders instantly —
 * no save round-trip. Clicking a section tells the editor which one to open.
 */
export function PreviewBridge({ initial, site }: { initial: SectionData[]; site: SiteContact }) {
  const [sections, setSections] = useState(initial);

  useEffect(() => {
    const onMessage = (e: MessageEvent<PreviewMessage>) => {
      if (e.origin !== window.location.origin || !e.data || typeof e.data !== "object") return;
      if (e.data.type === "az:preview:update") {
        const { id, data } = e.data;
        setSections((all) => all.map((s) => (s.id === id ? ({ ...s, data } as SectionData) : s)));
      }
      if (e.data.type === "az:preview:focus") {
        document.querySelector(`[data-section-id="${CSS.escape(e.data.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element).closest<HTMLElement>("[data-section-id]");
      // Links inside the preview shouldn't navigate the iframe away.
      if ((e.target as Element).closest("a")) e.preventDefault();
      if (el && window.parent !== window) {
        window.parent.postMessage({ type: "az:preview:select", id: el.dataset.sectionId }, window.location.origin);
      }
    };
    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick, true);
    window.parent?.postMessage({ type: "az:preview:ready" }, window.location.origin);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return (
    <main className="min-h-dvh bg-ink">
      <SectionRenderer sections={sections} site={site} />
    </main>
  );
}
