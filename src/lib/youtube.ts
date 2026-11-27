/**
 * YouTube helpers shared by the server (validation, SEO) and the browser (admin form, the player facade).
 * Pure functions only: no fetches here (oEmbed lives in features/projects, server side).
 *
 * Every playable film is a YouTube URL (docs/03). We store the URL as entered plus the parsed 11-char id,
 * and never trust the thumbnail for orientation: YouTube serves 16:9 thumbnails even for Shorts.
 */

export type VideoOrientation = "landscape" | "portrait" | "square";
export type YouTubeKind = "video" | "short" | "live";
export type ParsedYouTube = { id: string; kind: YouTubeKind; start?: number };

const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** "1m30s" | "90" | "90s" | "1h2m3s" → seconds. Anything else → undefined. */
export function parseStart(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value) || undefined;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!m || !(m[1] || m[2] || m[3])) return undefined;
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return s || undefined;
}

/**
 * Accepts watch, youtu.be, /shorts/, /embed/, /live/ and /v/ links on YouTube's own hosts (with or
 * without a scheme). Rejects everything else, including lookalike hosts and playlists without a video.
 */
export function parseYouTubeUrl(input: string | null | undefined): ParsedYouTube | null {
  const raw = (input ?? "").trim();
  if (!raw || raw.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;

  const start = parseStart(url.searchParams.get("t") ?? url.searchParams.get("start"));
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | undefined;
  let kind: YouTubeKind = "video";

  if (host.endsWith("youtu.be")) {
    id = parts[0];
  } else if (parts[0] === "watch" && parts.length === 1) {
    id = url.searchParams.get("v") ?? undefined;
  } else if (parts.length >= 2 && ["shorts", "embed", "live", "v"].includes(parts[0]!)) {
    id = parts[1];
    if (parts[0] === "shorts") kind = "short";
    if (parts[0] === "live") kind = "live";
  }
  if (!id || !ID.test(id)) return null;
  return start ? { id, kind, start } : { id, kind };
}

export const isYouTubeId = (id: string) => ID.test(id);

/** Canonical public link (what "Open on YouTube" and the sitemap point at). */
export function watchUrl(id: string, kind: YouTubeKind = "video"): string {
  return kind === "short" ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
}

/** Privacy-enhanced embed for the click-to-play facade. */
export function embedUrl(
  id: string,
  opts: { autoplay?: boolean; origin?: string; start?: number } = {},
): string {
  const q = new URLSearchParams({
    ...(opts.autoplay ? { autoplay: "1" } : {}),
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
    ...(opts.origin ? { origin: opts.origin } : {}),
    ...(opts.start ? { start: String(Math.floor(opts.start)) } : {}),
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${q}`;
}

/** Public embed URL for structured data (schema.org VideoObject.embedUrl, sitemap player_loc). */
export const publicEmbedUrl = (id: string) => `https://www.youtube.com/embed/${id}`;

export type ThumbSize = "maxresdefault" | "sddefault" | "hqdefault" | "mqdefault";
export const thumbnailUrl = (id: string, size: ThumbSize = "maxresdefault") =>
  `https://i.ytimg.com/vi/${id}/${size}.jpg`;

/** A /shorts/ link is a portrait reel. Everything else is landscape until the admin says otherwise. */
export function orientationFromUrl(input: string | null | undefined): VideoOrientation {
  return parseYouTubeUrl(input)?.kind === "short" ? "portrait" : "landscape";
}

/** width / height for a film box: the exact aspect when the admin set one, else the orientation's default. */
export function aspectFor(orientation: VideoOrientation, aspect?: number | null): number {
  if (aspect && Number.isFinite(aspect) && aspect > 0.2 && aspect < 5) return aspect;
  return orientation === "portrait" ? 9 / 16 : orientation === "square" ? 1 : 16 / 9;
}

/** "2:41" | "161" | "1:02:03" → seconds (admin runtime field). Invalid → null. */
export function parseRuntime(value: string | null | undefined): number | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(v)) return null;
  const parts = v.split(":").map(Number);
  if (parts.slice(1).some((n) => n >= 60)) return null;
  const s = parts.reduce((acc, n) => acc * 60 + n, 0);
  return s > 0 ? s : null;
}
