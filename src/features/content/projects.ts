import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import type { Asset, Project } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  aspectFor,
  parseYouTubeUrl,
  publicEmbedUrl,
  watchUrl,
  type VideoOrientation,
  type YouTubeKind,
} from "@/lib/youtube";
import { getWorkList, type WorkItem } from "./queries";
import { tags } from "./tags";

export type MediaImage = { src: string; alt: string; width?: number; height?: number; blurDataUrl?: string };
/** A project's film: always a YouTube video behind the click-to-play facade (#24, #25). */
export type Film = {
  youtubeId: string;
  kind: YouTubeKind;
  orientation: VideoOrientation;
  /** width / height of the player box */
  aspect: number;
  /** Seconds (typed by the admin; oEmbed has no duration) */
  duration?: number;
  start?: number;
  /** The project cover (LCP image), not the YouTube thumbnail */
  poster: MediaImage;
  /** https://www.youtube.com/embed/<id> — for VideoObject / the video sitemap */
  embedUrl: string;
  /** Public watch / shorts link */
  watchUrl: string;
};

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
  /** Admin overrides for <title> / meta description (fall back to title — format / summary). */
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: Date;
  updatedAt?: Date;
  next?: { slug: string; title: string; cover: MediaImage };
};

/** <title> and meta description: the admin SEO fields win, then "Title — Format" and the summary. */
export function projectMeta(p: Pick<ProjectDetail, "title" | "format" | "summary" | "seoTitle" | "seoDescription">) {
  return {
    title: p.seoTitle || `${p.title} — ${p.format}`,
    description: p.seoDescription || p.summary || `${p.title}, a ${p.format.toLowerCase()} edited by Ashyan Zafar.`,
  };
}

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

export const orientationOf = (o: "LANDSCAPE" | "PORTRAIT" | "SQUARE" | null | undefined): VideoOrientation =>
  o === "PORTRAIT" ? "portrait" : o === "SQUARE" ? "square" : "landscape";

type FilmColumns = Pick<
  Project,
  "filmUrl" | "filmYoutubeId" | "filmOrientation" | "filmAspect" | "filmDuration"
>;

/** The film from the project's YouTube columns (re-parsed, so a bad stored URL never reaches the page). */
export function filmOf(p: FilmColumns, poster: MediaImage): Film | undefined {
  const parsed = parseYouTubeUrl(p.filmUrl);
  const id = parsed?.id ?? undefined;
  if (!id || (p.filmYoutubeId && p.filmYoutubeId !== id)) return undefined;
  const orientation = orientationOf(p.filmOrientation);
  return {
    youtubeId: id,
    kind: parsed!.kind,
    orientation,
    aspect: aspectFor(orientation, p.filmAspect),
    duration: p.filmDuration ?? undefined,
    start: parsed!.start,
    poster,
    embedUrl: publicEmbedUrl(id),
    watchUrl: watchUrl(id, parsed!.kind),
  };
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
    film: filmOf(p, cover),
    loopPlaybackId: p.loop?.status === "READY" ? (p.loop.playbackId ?? undefined) : undefined,
    gallery: p.gallery.flatMap((g) => image(g.asset) ?? []),
    seoTitle: p.seoTitle?.trim() || undefined,
    seoDescription: p.seoDescription?.trim() || undefined,
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
