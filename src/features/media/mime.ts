import type { MediaKind } from "./types";

/**
 * Accepted file types per media kind. Client-safe (no Node imports): the server validates with
 * `kindFromMime`, and the Upload dialog turns an `accept` string into the explicit list the
 * Google Picker needs (it has no wildcards).
 */
export const ACCEPTED_MIME: Record<MediaKind, readonly string[]> = {
  IMAGE: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml"],
  VIDEO: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/x-m4v"],
  AUDIO: [
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/x-wav",
    "audio/aac",
    "audio/ogg",
    "audio/flac",
  ],
  DOCUMENT: ["application/pdf"],
};

export function kindFromMime(mimeType: string): MediaKind | null {
  for (const kind of Object.keys(ACCEPTED_MIME) as MediaKind[]) {
    if (ACCEPTED_MIME[kind].includes(mimeType)) return kind;
  }
  return null;
}

/** "image/*,video/*,application/pdf" → every accepted type those patterns cover. */
export function mimeTypesForAccept(accept: string): string[] {
  const all = Object.values(ACCEPTED_MIME).flat();
  const patterns = accept
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return all.filter((type) =>
    patterns.some((p) => (p.endsWith("/*") ? type.startsWith(p.slice(0, -1)) : p === type)),
  );
}
