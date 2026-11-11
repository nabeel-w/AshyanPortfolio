import "server-only";
import { createHash } from "node:crypto";
import { getSessionCookie } from "better-auth/cookies";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { tags } from "@/features/content/tags";
import type { EventType } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { classifySource, parseUtm, referrerHost, type Source } from "./source";
import { browserOf, deviceOf, isBot } from "./ua";

/** Events the public beacon may send. CONTACT_SUBMIT is recorded by the server only (no spoofed leads). */
export const clientEventSchema = z.object({
  t: z.enum(["PAGEVIEW", "VIDEO_PLAY", "VIDEO_PROGRESS", "VIDEO_COMPLETE", "CTA_CLICK", "OUTBOUND_CLICK"]),
  p: z.string().startsWith("/").max(300),
  r: z.string().max(1000).optional(),
  q: z.string().max(1000).optional(),
  v: z.number().finite().min(0).max(100).optional(),
  l: z.string().max(100).optional(),
});
export type ClientEvent = z.infer<typeof clientEventSchema>;

export type EventInput = {
  type: EventType;
  path: string;
  referrer?: string | null;
  search?: string | null;
  value?: number;
  label?: string;
};

export type DropReason = "bot" | "admin" | "rate-limited";

const SESSION_GAP_MS = 30 * 60 * 1000;
const RATE = { max: 120, windowMs: 60 * 1000 };

const sha = (s: string) => createHash("sha256").update(s).digest("base64url").slice(0, 22);
const salt = () => env.ANALYTICS_SALT ?? env.BETTER_AUTH_SECRET;

/** Daily-rotating visitor id: no cookie, and the IP never leaves this function. */
export function visitorHash(ip: string, ua: string, now: Date) {
  return sha(`${salt()}|${now.toISOString().slice(0, 10)}|${ip}|${ua}`);
}

export function clientIp(h: Headers) {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0";
}

// Per-instance limiter. Fluid Compute reuses instances, which is enough to stop a runaway client;
// it isn't a security boundary.
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimited(key: string, now = Date.now()) {
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + RATE.windowMs });
    return false;
  }
  b.count += 1;
  return b.count > RATE.max;
}

/** `/work/<slug>` → project id, cached until projects change. */
async function projectIdForSlug(slug: string): Promise<string | null> {
  "use cache";
  cacheTag(tags.projects);
  cacheLife("hours");
  const p = await db.project.findUnique({ where: { slug }, select: { id: true } });
  return p?.id ?? null;
}

export function projectSlug(path: string) {
  return /^\/work\/([a-z0-9-]+)\/?$/i.exec(path)?.[1] ?? null;
}

function internalHosts(h: Headers) {
  const hosts = [new URL(env.NEXT_PUBLIC_SITE_URL).hostname, new URL(env.BETTER_AUTH_URL).hostname];
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) hosts.push(host.split(":")[0]);
  return hosts;
}

/**
 * Store one event. Filters bots and signed-in admins, derives visitor/session ids, classifies the
 * source (internal navigation keeps the session's original source), and adds country/device/browser.
 */
export async function recordEvent(input: EventInput, h: Headers, now = new Date()): Promise<{ stored: true } | { stored: false; reason: DropReason }> {
  const ua = h.get("user-agent") ?? "";
  if (isBot(ua)) return { stored: false, reason: "bot" };
  // Only admins can hold a session, so any session cookie means "don't count me".
  if (getSessionCookie(h)) return { stored: false, reason: "admin" };

  const visitor = visitorHash(clientIp(h), ua, now);
  if (rateLimited(visitor, now.getTime())) return { stored: false, reason: "rate-limited" };

  const utm = parseUtm(input.search);
  const hasUtm = Boolean(utm.source || utm.medium || utm.campaign);
  const landed = classifySource({ referrer: input.referrer, utm, internalHosts: internalHosts(h) });
  const external = hasUtm || (landed !== null && landed !== "DIRECT");

  const prev = await db.analyticsEvent.findFirst({
    where: { visitorHash: visitor, createdAt: { gte: new Date(now.getTime() - SESSION_GAP_MS) } },
    orderBy: { createdAt: "desc" },
    select: { sessionHash: true, source: true, referrer: true, utmSource: true, utmMedium: true, utmCampaign: true },
  });

  // A new external landing (another referrer or campaign) starts a new session, like GA does.
  const continuing = prev && !external;
  const source: Source = continuing ? prev.source : (landed ?? "DIRECT");
  const slug = projectSlug(input.path);

  await db.analyticsEvent.create({
    data: {
      type: input.type,
      visitorHash: visitor,
      sessionHash: continuing ? prev.sessionHash : sha(`${visitor}|${now.getTime()}`),
      path: input.path.split(/[?#]/)[0].slice(0, 200) || "/",
      projectId: slug ? await projectIdForSlug(slug) : null,
      value: input.value ?? null,
      label: input.label?.slice(0, 100) ?? null,
      referrer: continuing ? prev.referrer : landed === null ? null : referrerHost(input.referrer),
      source,
      utmSource: continuing ? prev.utmSource : (utm.source ?? null),
      utmMedium: continuing ? prev.utmMedium : (utm.medium ?? null),
      utmCampaign: continuing ? prev.utmCampaign : (utm.campaign ?? null),
      country: h.get("x-vercel-ip-country")?.slice(0, 2).toUpperCase() || null,
      device: deviceOf(ua),
      browser: browserOf(ua),
      createdAt: now,
    },
  });
  return { stored: true };
}

/** Server-side events (e.g. CONTACT_SUBMIT from a server action). Never throws: analytics must not break the caller. */
export async function recordServerEvent(input: EventInput, h: Headers) {
  try {
    return await recordEvent(input, h);
  } catch (error) {
    console.warn("[analytics] failed to record", input.type, error);
    return null;
  }
}
