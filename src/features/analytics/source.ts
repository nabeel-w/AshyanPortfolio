/**
 * Referrer / UTM → traffic source. Pure, shared by the ingest route and its tests.
 * Order matters: AI assistants are checked before search (gemini.google.com is not Google Search).
 */

export type Source = "DIRECT" | "SEARCH" | "AI" | "SOCIAL" | "REFERRAL" | "EMAIL" | "PAID";

const AI = [
  "chatgpt.com",
  "chat.openai.com",
  "openai.com",
  "perplexity.ai",
  "claude.ai",
  "gemini.google.com",
  "bard.google.com",
  "copilot.microsoft.com",
  "you.com",
  "phind.com",
  "poe.com",
  "meta.ai",
  "chat.mistral.ai",
  "chat.deepseek.com",
  "grok.com",
  "kagi.com/assistant",
];

const SEARCH = [
  "google.",
  "bing.com",
  "duckduckgo.com",
  "search.yahoo.com",
  "yahoo.com",
  "yandex.",
  "baidu.com",
  "ecosia.org",
  "search.brave.com",
  "startpage.com",
  "qwant.com",
  "kagi.com",
  "naver.com",
];

const SOCIAL = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "l.instagram.com",
  "t.co",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "lnkd.in",
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "reddit.com",
  "pinterest.com",
  "tiktok.com",
  "threads.net",
  "threads.com",
  "behance.net",
  "dribbble.com",
  "whatsapp.com",
  "wa.me",
  "telegram.org",
  "t.me",
  "bsky.app",
  "imdb.com",
];

const EMAIL = ["mail.google.com", "outlook.live.com", "outlook.office.com", "outlook.office365.com", "mail.yahoo.com", "mail.proton.me"];

/** Android apps send `android-app://<package>` as the referrer. */
const ANDROID_APPS: Record<string, Source> = {
  "com.google.android.gm": "EMAIL",
  "com.microsoft.office.outlook": "EMAIL",
  "com.google.android.googlequicksearchbox": "SEARCH",
  "com.openai.chatgpt": "AI",
  "com.google.android.apps.bard": "AI",
  "ai.perplexity.app.android": "AI",
  "com.anthropic.claude": "AI",
  "com.linkedin.android": "SOCIAL",
  "com.instagram.android": "SOCIAL",
  "com.facebook.katana": "SOCIAL",
  "com.twitter.android": "SOCIAL",
  "com.whatsapp": "SOCIAL",
  "com.reddit.frontpage": "SOCIAL",
  "com.google.android.youtube": "SOCIAL",
};

/** `host` matches `entry` if equal or a subdomain; entries ending in "." match any TLD (google.co.uk). */
function matches(host: string, path: string, list: string[]) {
  return list.some((entry) => {
    const slash = entry.indexOf("/");
    const h = slash < 0 ? entry : entry.slice(0, slash);
    const p = slash < 0 ? "" : entry.slice(slash + 1);
    if (p && !path.startsWith(`/${p}`)) return false;
    if (h.endsWith(".")) return host.startsWith(h) || host.includes(`.${h}`);
    return host === h || host.endsWith(`.${h}`);
  });
}

/** Lower-cased host without `www.`, or null when the value isn't a URL. */
export function referrerHost(referrer?: string | null): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.protocol === "android-app:") return url.hostname.toLowerCase() || null;
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function fromHost(host: string, path = "/"): Source {
  if (matches(host, path, AI)) return "AI";
  if (matches(host, path, EMAIL)) return "EMAIL";
  if (matches(host, path, SEARCH)) return "SEARCH";
  if (matches(host, path, SOCIAL)) return "SOCIAL";
  return "REFERRAL";
}

export type Utm = { source?: string | null; medium?: string | null; campaign?: string | null };

/** UTM tags win over the referrer (ChatGPT, for one, appends `utm_source=chatgpt.com`). */
function fromUtm({ source, medium }: Utm): Source | null {
  const m = (medium ?? "").toLowerCase();
  const s = (source ?? "").toLowerCase().replace(/^www\./, "");
  if (!m && !s) return null;
  if (/^(cpc|ppc|paid|paidsearch|paid_search|paidsocial|paid_social|display|cpm|banner|ads?)$/.test(m)) return "PAID";
  if (/e-?mail|newsletter/.test(m) || /e-?mail|newsletter|mailchimp|substack/.test(s)) return "EMAIL";
  if (s) {
    const bySource = fromHost(s.includes(".") ? s : `${s}.com`);
    if (bySource !== "REFERRAL") return bySource;
    if (/^(chatgpt|openai|perplexity|claude|gemini|copilot)/.test(s)) return "AI";
  }
  if (/social|sm|social-network|social-media/.test(m)) return "SOCIAL";
  if (/organic|search/.test(m)) return "SEARCH";
  return s ? "REFERRAL" : null;
}

/**
 * Classify one landing. `internalHosts` are our own hosts: a referrer from them is internal
 * navigation and returns null, so the caller can keep the session's original source.
 */
export function classifySource(input: { referrer?: string | null; utm?: Utm; internalHosts?: string[] }): Source | null {
  const utm = input.utm ? fromUtm(input.utm) : null;
  if (utm) return utm;
  if (!input.referrer) return "DIRECT";
  let url: URL;
  try {
    url = new URL(input.referrer);
  } catch {
    return "DIRECT";
  }
  if (url.protocol === "android-app:") return ANDROID_APPS[url.hostname.toLowerCase()] ?? "REFERRAL";
  const host = referrerHost(input.referrer);
  if (!host) return "DIRECT";
  const internal = (input.internalHosts ?? []).map((h) => h.toLowerCase().replace(/^www\./, ""));
  if (internal.includes(host)) return null;
  return fromHost(host, url.pathname);
}

/** `utm_*` params from a query string (`?a=b` or `a=b`). */
export function parseUtm(search?: string | null): Utm {
  if (!search) return {};
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const clip = (v: string | null) => (v ? v.trim().slice(0, 100) || null : null);
  return { source: clip(q.get("utm_source")), medium: clip(q.get("utm_medium")), campaign: clip(q.get("utm_campaign")) };
}
