import { z } from "zod";

/**
 * What the browser (or Drive's videoMediaMetadata) tells us about a video before we store it.
 * Vercel Blob keeps no dimensions for videos, and the bento grid and loops need the shape (#24).
 * Values are hints from the client, so they're range-checked; out-of-range fields are dropped.
 */
export type MediaProbe = { width?: number; height?: number; duration?: number };

/** Long edge up to 8K, short edge up to 8K; loops are seconds long but allow a 10-minute clip. */
const MAX_EDGE = 7680;
const MAX_DURATION = 600;

const dim = z.number().int().positive().max(MAX_EDGE);
const seconds = z.number().positive().max(MAX_DURATION);

export function cleanProbe(input: unknown): MediaProbe {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const out: MediaProbe = {};
  const width = dim.safeParse(raw.width);
  const height = dim.safeParse(raw.height);
  if (width.success && height.success) {
    out.width = width.data;
    out.height = height.data;
  }
  const duration = seconds.safeParse(raw.duration);
  if (duration.success) out.duration = Math.round(duration.data * 1000) / 1000;
  return out;
}
