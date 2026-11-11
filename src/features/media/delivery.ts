/**
 * Client-safe delivery URLs for streamed video. Only Mux is wired today; other streaming providers
 * store equivalent URLs in Asset.url / Asset.meta at finalize time.
 */
export const mux = {
  poster: (playbackId: string, time = 1, width?: number) =>
    `https://image.mux.com/${playbackId}/thumbnail.webp?time=${time}${width ? `&width=${width}` : ""}`,
  hls: (playbackId: string) => `https://stream.mux.com/${playbackId}.m3u8`,
  /** Static MP4 rendition (requested at upload as resolution "highest"). Used for short muted loops. */
  mp4: (playbackId: string) => `https://stream.mux.com/${playbackId}/highest.mp4`,
};

/** 125.4 → "PT2M5S" (schema.org duration). */
export function isoDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${r || (!h && !m) ? `${r}S` : ""}`;
}

/** 125.4 → "2:05" */
export function clockDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
