import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import type { Asset } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getWorkList, type WorkItem } from "./queries";
import { tags } from "./tags";

export type MediaImage = { src: string; alt: string; width?: number; height?: number; blurDataUrl?: string };
export type Film = { playbackId: string; duration?: number; aspectRatio?: number; poster: string };

export type ProjectDetail = {
  slug: string;
  title: string;
  format: string;
  clientName?: string;
  year: number;
  role?: string;
  category: string;
  summary: string;
  /** Paragraphs */
  story: string[];
  transcript?: string;
  credits: { role: string; name: string }[];
  cover: MediaImage;
  film?: Film;
  loopPlaybackId?: string;
  gallery: MediaImage[];
  publishedAt?: Date;
  updatedAt?: Date;
  next?: { slug: string; title: string; cover: MediaImage };
};

const creditsSchema = z.array(z.object({ role: z.string(), name: z.string() })).catch([]);

const image = (a: Asset | null | undefined): MediaImage | undefined =>
  a?.status === "READY" && a.url
    ? {
        src: a.url,
        alt: a.alt,
        width: a.width ?? undefined,
        height: a.height ?? undefined,
        blurDataUrl: a.blurDataUrl ?? undefined,
      }
    : undefined;

function film(a: Asset | null | undefined): Film | undefined {
  if (a?.status !== "READY" || !a.playbackId) return undefined;
  const meta = (a.meta ?? {}) as { aspectRatio?: number };
  return { playbackId: a.playbackId, duration: a.duration ?? undefined, aspectRatio: meta.aspectRatio, poster: a.url ?? "" };
}

const paragraphs = (text?: string | null) =>
  (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/** Slugs to prerender. Never empty: falls back to the placeholder work list (Cache Components requires ≥ 1). */
export async function getProjectSlugs(): Promise<string[]> {
  "use cache";
  cacheTag(tags.projects);
  cacheLife("max");
  const rows = await db.project.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });
  if (rows.length) return rows.map((r) => r.slug);
  return (await getWorkList()).map((p) => p.slug);
}

export async function getProject(slug: string): Promise<ProjectDetail | null> {
  "use cache";
  cacheTag(tags.project(slug), tags.projects);
  cacheLife("max");

  const p = await db.project.findFirst({
    where: { slug, status: "PUBLISHED" },
    include: {
      category: true,
      cover: true,
      film: true,
      loop: true,
      gallery: { include: { asset: true }, orderBy: { order: "asc" } },
    },
  });

  if (!p) return fallbackProject(slug);
  const cover = image(p.cover);
  if (!cover) return null;

  const siblings = await db.project.findMany({
    where: { status: "PUBLISHED", cover: { status: "READY" } },
    orderBy: [{ featured: "desc" }, { order: "asc" }, { publishedAt: "desc" }],
    select: { slug: true, title: true, cover: true },
  });
  const i = siblings.findIndex((s) => s.slug === slug);
  const nextRow = siblings.length > 1 ? siblings[(i + 1) % siblings.length] : undefined;
  const nextCover = image(nextRow?.cover);

  return {
    slug: p.slug,
    title: p.title,
    format: p.format ?? "Film",
    clientName: p.clientName ?? undefined,
    year: p.year ?? p.createdAt.getFullYear(),
    role: p.role ?? undefined,
    category: p.category?.name ?? "Film",
    summary: p.summary ?? "",
    story: paragraphs(p.story),
    transcript: p.transcript?.trim() || undefined,
    credits: creditsSchema.parse(p.credits ?? []),
    cover,
    film: film(p.film),
    loopPlaybackId: p.loop?.status === "READY" ? (p.loop.playbackId ?? undefined) : undefined,
    gallery: p.gallery.flatMap((g) => image(g.asset) ?? []),
    publishedAt: p.publishedAt ?? undefined,
    updatedAt: p.updatedAt,
    next: nextRow && nextCover ? { slug: nextRow.slug, title: nextRow.title, cover: nextCover } : undefined,
  };
}

/** Placeholder detail for fresh environments (no projects in the DB yet). */
async function fallbackProject(slug: string): Promise<ProjectDetail | null> {
  const list = await getWorkList();
  const i = list.findIndex((p) => p.slug === slug);
  const p: WorkItem | undefined = list[i];
  if (!p) return null;
  const next = list.length > 1 ? list[(i + 1) % list.length] : undefined;
  return {
    slug: p.slug,
    title: p.title,
    format: p.format,
    year: p.year,
    category: p.category,
    summary: `${p.title} — ${p.format.toLowerCase()} edited by Ashyan Zafar.`,
    story: [],
    credits: [],
    cover: p.cover,
    gallery: [],
    next: next ? { slug: next.slug, title: next.title, cover: next.cover } : undefined,
  };
}
