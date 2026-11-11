/**
 * Browser-side event sender (no React, no deps). Uses sendBeacon so it survives navigation,
 * falling back to a keepalive fetch. The referrer and query string go with the first pageview of
 * each document only; later client-side navigations inherit the session's source on the server.
 */

export type TrackType = "PAGEVIEW" | "VIDEO_PLAY" | "VIDEO_PROGRESS" | "VIDEO_COMPLETE" | "CTA_CLICK" | "OUTBOUND_CLICK";

const ENDPOINT = "/api/analytics";
let landed = false;

export function track(t: TrackType, extra: { v?: number; l?: string } = {}) {
  if (typeof window === "undefined") return;
  const event: Record<string, unknown> = { t, p: location.pathname, ...extra };
  if (t === "PAGEVIEW" && !landed) {
    landed = true;
    if (document.referrer) event.r = document.referrer;
    if (location.search) event.q = location.search;
  }
  const body = JSON.stringify(event);
  try {
    if (navigator.sendBeacon?.(ENDPOINT, body)) return;
  } catch {
    // fall through to fetch
  }
  fetch(ENDPOINT, { method: "POST", body, keepalive: true }).catch(() => {});
}

/** CTA / outbound click classification for the delegated click listener. */
export function clickEvent(target: Element | null, origin: string): { t: TrackType; l: string } | null {
  const cta = target?.closest("[data-cta]")?.getAttribute("data-cta");
  if (cta) return { t: "CTA_CLICK", l: cta };
  const a = target?.closest("a");
  const href = a?.getAttribute("href");
  if (!a || !href) return null;
  if (href.startsWith("mailto:")) return { t: "CTA_CLICK", l: "email" };
  if (href.startsWith("tel:")) return { t: "CTA_CLICK", l: "phone" };
  let url: URL;
  try {
    url = new URL(a.href, origin);
  } catch {
    return null;
  }
  if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== origin) {
    return { t: "OUTBOUND_CLICK", l: url.hostname.replace(/^www\./, "") };
  }
  return null;
}
