"use client";

import { useEffect, useState } from "react";
import type { Live } from "@/features/analytics/queries";

/** Visitors in the last 30 minutes, refreshed every 30 s while the tab is visible. */
export function LivePanel({ initial }: { initial: Live }) {
  const [live, setLive] = useState(initial);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/admin/analytics/live", { cache: "no-store" });
        if (res.ok && !stopped) setLive(await res.json());
      } catch {
        // keep the last reading
      }
    };
    const id = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span aria-hidden className="relative flex size-2.5 -translate-y-1">
          {live.visitors ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-bright opacity-60" /> : null}
          <span className={live.visitors ? "relative inline-flex size-2.5 rounded-full bg-red-bright" : "relative inline-flex size-2.5 rounded-full bg-smoke"} />
        </span>
        <p className="font-sans text-4xl font-semibold text-ivory" aria-live="polite">
          {live.visitors}
        </p>
        <p className="text-sm text-smoke">
          {live.visitors === 1 ? "visitor" : "visitors"} · {live.pageviews} page views in the last 30 min
        </p>
      </div>
      {live.pages.length ? (
        <ul className="mt-4 space-y-1.5 text-sm">
          {live.pages.map((p) => (
            <li key={p.path} className="flex justify-between gap-4">
              <span className="truncate text-ivory/80">{p.path === "/" ? "Home" : p.path}</span>
              <span className="text-smoke tabular-nums">{p.views}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
