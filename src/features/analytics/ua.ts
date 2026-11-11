/** Tiny user-agent helpers for the analytics ingest. Deliberately coarse: no UA library. */

// Crawlers and unfurlers only. In-app browsers (Instagram, FBAN, Telegram webviews) are real people.
const BOT =
  /(?<!cu)bot\b|bot\/|crawl|spider|slurp|scrape|preview|monitor|uptime|lighthouse|pagespeed|headless|phantom|puppeteer|playwright|selenium|^curl|wget|python|httpx|axios|node-fetch|go-http|java\/|okhttp|facebookexternalhit|embedly|quora link|^whatsapp|slack-imgproxy|vercel-|chatgpt-user|oai-searchbot|claude-|anthropic|perplexity-|bytespider|ccbot|semrush|ahrefs|mj12|dataforseo/i;

/** True for crawlers, link unfurlers, headless browsers and scripts (and an empty UA). */
export function isBot(ua?: string | null): boolean {
  if (!ua || ua.length < 20) return true;
  return BOT.test(ua);
}

export type Device = "mobile" | "tablet" | "desktop";

export function deviceOf(ua: string): Device {
  if (/ipad|tablet|playbook|silk|kindle/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/i.test(ua)) return "mobile";
  return "desktop";
}

export function browserOf(ua: string): string {
  if (/edg(e|a|ios)?\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/crios|chrome|chromium/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}
