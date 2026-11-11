/** Display helpers for the analytics dashboard. Pure. */

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en");

/** 1,284 · 12.9K · 4.2M (full under 10,000). */
export const num = (n: number) => (Math.abs(n) < 10_000 ? full.format(n) : compact.format(n));

/** 0.1234 → "12.3%" (one decimal under 10%, none above). */
export function pct(ratio: number | null | undefined) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  const v = ratio * 100;
  return `${v < 10 && v !== 0 ? v.toFixed(1) : Math.round(v)}%`;
}

/** A 0–100 value (avg watch %) → "62%". */
export const pct100 = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);

export function signedPct(ratio: number | null) {
  if (ratio === null) return "new";
  const v = Math.round(ratio * 100);
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)}%`;
}

const SOURCE_LABELS: Record<string, string> = {
  DIRECT: "Direct",
  SEARCH: "Search",
  AI: "AI assistants",
  SOCIAL: "Social",
  REFERRAL: "Referral",
  EMAIL: "Email",
  PAID: "Paid",
};
export const sourceLabel = (s: string) => SOURCE_LABELS[s] ?? s;

const regions = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
export function countryName(code: string) {
  if (code === "unknown") return "Unknown";
  try {
    return regions?.of(code) ?? code;
  } catch {
    return code;
  }
}

export const pageLabel = (path: string) => (path === "/" ? "Home" : path);

const shortDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });
export const dayLabel = (day: string) => shortDate.format(new Date(`${day}T00:00:00Z`));

const CTA_LABELS: Record<string, string> = { hero: "Hero call to action", about: "About call to action", email: "Email link", phone: "Phone link", whatsapp: "WhatsApp button" };
export const ctaLabel = (key: string) => CTA_LABELS[key] ?? key;
