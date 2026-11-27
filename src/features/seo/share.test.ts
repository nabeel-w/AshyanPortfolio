import { describe, expect, it } from "vitest";
import {
  accentParts,
  estimateLines,
  FALLBACK_HEADLINE,
  pageShareCard,
  pageShareSchema,
  parsePageShare,
  parseSiteShare,
  projectShareCard,
  shareChecks,
  shareVersion,
  siteShareSchema,
  titleTemplateFor,
} from "./share";

const site = { name: "Ashyan Zafar", role: "Film Editor", location: "India · Working worldwide" };
const hero = { headline: "Crafting visual stories *through edit.*", src: "https://blob/hero.jpg" };
const defaults = parseSiteShare(null);

describe("share settings schema (#33)", () => {
  it("fills defaults that reproduce today's card", () => {
    expect(defaults).toMatchObject({
      template: "still",
      focalX: 0.5,
      focalY: 0.5,
      headline: "",
      meta: "",
      showMonogram: true,
      showWordmark: true,
      titleTemplate: "%s — {name}",
    });
  });

  it("never throws on bad stored data, and validates what the admin types", () => {
    expect(parseSiteShare({ template: "neon", overlay: 400 })).toEqual(defaults);
    expect(parsePageShare("garbage")).toEqual(pageShareSchema.parse({}));
    expect(siteShareSchema.safeParse({ titleTemplate: "No placeholder" }).success).toBe(false);
    expect(siteShareSchema.safeParse({ twitterHandle: "@bad handle!" }).success).toBe(false);
    expect(siteShareSchema.parse({ twitterHandle: "@ashyan_z" }).twitterHandle).toBe("@ashyan_z");
    expect(titleTemplateFor(siteShareSchema.parse({ titleTemplate: "%s | {name}" }), site.name)).toBe("%s | Ashyan Zafar");
  });
});

describe("pageShareCard precedence", () => {
  it("with nothing customised it is today's card: hero still, hero headline, ROLE · LOCATION, overlay 72", () => {
    expect(pageShareCard({ site, settings: defaults, hero })).toEqual({
      template: "still",
      variant: "site",
      background: "https://blob/hero.jpg",
      focal: { x: 0.5, y: 0.5 },
      overlay: 72,
      headline: hero.headline,
      meta: "FILM EDITOR  ·  INDIA · WORKING WORLDWIDE",
      monogram: true,
      wordmark: true,
      siteName: "Ashyan Zafar",
    });
  });

  it("page override → Settings → hero → fallback", () => {
    const settings = siteShareSchema.parse({ headline: "From *settings*", image: { src: "/settings.jpg" }, meta: "editor" });
    const override = pageShareSchema.parse({ headline: "About *me*", image: { src: "/about.jpg" }, focalX: 0.2 });
    expect(pageShareCard({ site, settings, hero, override })).toMatchObject({
      headline: "About *me*",
      background: "/about.jpg",
      focal: { x: 0.2, y: 0.5 },
      meta: "EDITOR",
    });
    expect(pageShareCard({ site, settings, hero })).toMatchObject({ headline: "From *settings*", background: "/settings.jpg" });
    expect(pageShareCard({ site, settings: defaults })).toMatchObject({ headline: FALLBACK_HEADLINE, background: "/media/hero.webp" });
  });

  it("label pages carry the label name", () => {
    expect(pageShareCard({ site, settings: defaults, hero, labelName: "Fashion" }).headline).toBe("Fashion *work.*");
  });
});

describe("projectShareCard", () => {
  const project = { title: "Résonance", cover: "/c.jpg", format: "Fashion Film", clientName: "Atelier Rouge", year: 2023 };

  it("uses the cover, the title and FORMAT · CLIENT · YEAR, at the old film-card overlay", () => {
    expect(projectShareCard({ site, settings: defaults, project })).toMatchObject({
      template: "still",
      variant: "project",
      background: "/c.jpg",
      headline: "Résonance",
      meta: "FASHION FILM  ·  ATELIER ROUGE  ·  2023",
      overlay: 55,
    });
  });

  it("gives reels the portrait split with REEL · LABEL · YEAR, unless overridden", () => {
    const reel = { ...project, orientation: "portrait" as const, labelName: "Fashion" };
    expect(projectShareCard({ site, settings: defaults, project: reel })).toMatchObject({ template: "portrait", meta: "REEL  ·  FASHION  ·  2023" });
    const override = pageShareSchema.parse({ template: "still", headline: "Watch *Night Shift*" });
    expect(projectShareCard({ site, settings: defaults, project: reel, override })).toMatchObject({ template: "still", headline: "Watch *Night Shift*" });
  });
});

describe("shareVersion", () => {
  it("is stable for the same card and changes with any field", () => {
    const a = pageShareCard({ site, settings: defaults, hero });
    expect(shareVersion(a)).toBe(shareVersion({ ...a }));
    expect(shareVersion({ ...a, headline: "Other" })).not.toBe(shareVersion(a));
    expect(shareVersion({ ...a, focal: { x: 0.3, y: 0.5 } })).not.toBe(shareVersion(a));
    expect(shareVersion(a)).toMatch(/^[0-9a-z]+$/);
  });
});

describe("headline helpers and checks", () => {
  it("splits the red italic accent", () => {
    expect(accentParts("Crafting visual stories *through edit.*")).toEqual([
      ["Crafting visual stories ", false],
      ["through edit.", true],
    ]);
    expect(accentParts("**CAPS** plain")).toEqual([["CAPS plain", false]]);
  });

  it("estimates wrapping at the card's 92px size", () => {
    expect(estimateLines("Crafting visual stories *through edit.*")).toBe(2);
    expect(estimateLines("A very long headline that keeps going and going well past what fits on the share card")).toBeGreaterThan(3);
  });

  it("warns (never blocks) about long headlines, small images, heavy cards and lengths", () => {
    const card = pageShareCard({ site, settings: defaults, hero, override: pageShareSchema.parse({ headline: "x".repeat(70) }) });
    const checks = shareChecks({
      card,
      settings: defaults,
      title: "t".repeat(65),
      description: "Too short.",
      imageSize: { width: 800, height: 1200 },
      bytes: 400 * 1024,
    }).map((c) => c.field);
    expect(checks).toEqual(expect.arrayContaining(["headline", "image", "focal", "card", "description", "title", "alt"]));
    const fine = shareChecks({
      card: pageShareCard({ site, settings: defaults, hero }),
      settings: siteShareSchema.parse({ alt: "Ashyan Zafar, film editor" }),
      title: "Ashyan Zafar — Film Editor",
      description: "Ashyan Zafar is an independent film editor crafting commercials, fashion films and documentaries.",
      imageSize: { width: 1672, height: 941 },
      bytes: 90 * 1024,
    });
    expect(fine).toEqual([]);
  });
});
