import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getProject } from "@/features/content/projects";
import { pageDefaults } from "@/features/content/page-defaults";
import { getLabel, getLabels, getPageMeta, getPublishedPage, getSite, getWorkList } from "@/features/content/queries";
import { tags } from "@/features/content/tags";
import { db } from "@/lib/db";
import {
  pageShareCard,
  parseSiteShare,
  projectShareCard,
  shareVersion,
  type PageShare,
  type ShareCardInput,
  type SiteShare,
} from "./share";

/**
 * Resolving the share card a URL actually gets (#33): Settings → the page's or project's override →
 * fallbacks, as a plain ShareCardInput plus its ?v= version. Pages point og:image at
 * /og/<kind>/<slug>?v=<version>, so editing a card changes the URL and chat apps fetch it again.
 */

export type ShareTarget = { kind: "page" | "project" | "label"; slug: string };
export type ResolvedCard = { input: ShareCardInput; version: string; alt: string; url: string };

export const SHARE_PAGES = ["home", "work", "about", "contact"] as const;

/** Settings → Sharing & SEO (cached with the site tag). */
export async function getShareSettings(): Promise<SiteShare> {
  "use cache";
  cacheTag(tags.site);
  cacheLife("max");
  const row = await db.siteSettings.findUnique({ where: { id: "site" }, select: { share: true } });
  return parseSiteShare(row?.share);
}

async function homeHero() {
  const home = await getPublishedPage("home");
  const hero = home.find((s) => s.type === "hero");
  return hero?.type === "hero" ? { headline: hero.data.headline, src: hero.data.media.src } : undefined;
}

export const sharePath = (t: ShareTarget, version: string) => `/og/${t.kind}/${t.slug}?v=${version}`;

/**
 * The card for a target. `draft` replaces the saved Settings / override (the admin preview).
 * Null when the target doesn't exist (unknown page, unpublished project, hidden label).
 */
export async function shareCardFor(
  target: ShareTarget,
  draft: { settings?: SiteShare; override?: PageShare } = {},
): Promise<ResolvedCard | null> {
  const [site, saved] = await Promise.all([getSite(), draft.settings ? null : getShareSettings()]);
  const settings = draft.settings ?? saved!;
  const shareSite = { name: site.name, role: site.role, location: site.location };
  let input: ShareCardInput;
  let alt: string;

  if (target.kind === "project") {
    const p = await getProject(target.slug);
    if (!p) return null;
    input = projectShareCard({
      site: shareSite,
      settings,
      override: draft.override ?? p.share,
      project: {
        title: p.title,
        cover: p.cover.src,
        format: p.format,
        clientName: p.clientName,
        year: p.year,
        orientation: p.film?.orientation,
        labelName: p.labels.find((l) => l.visible)?.name,
      },
    });
    alt = `${p.title}, ${p.format.toLowerCase()} edited by ${site.name}`;
  } else if (target.kind === "label") {
    const hit = await getLabel(target.slug);
    if (!hit || "redirect" in hit) return null;
    input = pageShareCard({ site: shareSite, settings, hero: await homeHero(), override: draft.override, labelName: hit.label.name });
    alt = `${hit.label.name} work by ${site.name}`;
  } else {
    if (!(SHARE_PAGES as readonly string[]).includes(target.slug)) return null;
    const [hero, meta] = await Promise.all([homeHero(), getPageMeta(target.slug)]);
    input = pageShareCard({ site: shareSite, settings, hero, override: draft.override ?? meta.share });
    alt = settings.alt || `${site.name}, ${site.role.toLowerCase()}`;
  }
  const version = shareVersion(input);
  return { input, version, alt, url: sharePath(target, version) };
}

/** og:image / twitter:image entries for a target (empty when it can't be resolved). */
export async function shareImages(target: ShareTarget) {
  const card = await shareCardFor(target);
  if (!card) return { openGraph: [], twitter: [] };
  return {
    openGraph: [{ url: card.url, width: 1200, height: 630, alt: card.alt, type: "image/jpeg" }],
    twitter: [{ url: card.url, alt: card.alt }],
  };
}

export type ShareTargetOption = {
  key: string;
  group: "Pages" | "Projects" | "Labels";
  label: string;
  target: ShareTarget;
  path: string;
  /** The <title> before the site template (null for home, which uses the full default title) */
  title: string | null;
  description: string;
};

/** Everything the Sharing & SEO preview can show: the four pages, every published film, every label page. */
export async function listShareTargets(): Promise<ShareTargetOption[]> {
  const [site, settings, work, labels] = await Promise.all([getSite(), getShareSettings(), getWorkList(), getLabels()]);
  const description = settings.defaultDescription || site.description;
  const pages = await Promise.all(
    SHARE_PAGES.map(async (slug): Promise<ShareTargetOption> => {
      const meta = await getPageMeta(slug);
      const defaults = slug === "home" ? null : pageDefaults[slug];
      return {
        key: `page:${slug}`,
        group: "Pages",
        label: slug === "home" ? "Home" : defaults!.title,
        target: { kind: "page", slug },
        path: slug === "home" ? "/" : `/${slug}`,
        title: slug === "home" ? null : (meta.title ?? defaults!.title),
        description: meta.description ?? defaults?.description ?? description,
      };
    }),
  );
  const projects = await Promise.all(
    work.map(async (w): Promise<ShareTargetOption | null> => {
      const p = await getProject(w.slug);
      if (!p) return null;
      return {
        key: `project:${p.slug}`,
        group: "Projects",
        label: p.title,
        target: { kind: "project", slug: p.slug },
        path: `/work/${p.slug}`,
        title: p.seoTitle || `${p.title} — ${p.format}`,
        description: p.seoDescription || p.summary || `${p.title}, a ${p.format.toLowerCase()} edited by ${site.name}.`,
      };
    }),
  );
  return [
    ...pages,
    ...projects.filter((p): p is ShareTargetOption => p !== null),
    ...labels
      .filter((l) => l.count > 0)
      .map(
        (l): ShareTargetOption => ({
          key: `label:${l.slug}`,
          group: "Labels",
          label: l.name,
          target: { kind: "label", slug: l.slug },
          path: `/work/label/${l.slug}`,
          title: `${l.name} — Work`,
          description: `${l.count} ${l.name.toLowerCase()} ${l.count === 1 ? "project" : "projects"} edited by ${site.name}.`,
        }),
      ),
  ];
}
