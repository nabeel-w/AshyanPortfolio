import { describe, expect, it } from "vitest";
import { homeSections } from "@/content/fallback";
import { contactCtaSchema, heroSchema, sectionSchemas, workGridSchema } from "./schemas";

describe("section schemas", () => {
  it("every fallback home section is valid for its schema (seed data stays publishable)", () => {
    for (const section of homeSections) {
      const result = sectionSchemas[section.type].safeParse(section.data);
      expect(result.success, `${section.type}: ${result.error?.message}`).toBe(true);
    }
  });

  it("fills hero defaults so editors can start from a minimal section", () => {
    const hero = heroSchema.parse({ media: { src: "/media/hero.webp" } });
    expect(hero).toMatchObject({
      eyebrow: "Film Editor · Visual Storyteller",
      headline: "Crafting visual stories *through edit.*",
      cta: { label: "View selected work", href: "#work" },
      media: { src: "/media/hero.webp", alt: "" },
    });
  });

  it("work grid defaults to the black (ink) tone", () => {
    expect(workGridSchema.parse({}).tone).toBe("ink");
    expect(() => workGridSchema.parse({ tone: "beige" })).toThrow();
  });

  it("rejects malformed data instead of rendering it", () => {
    expect(heroSchema.safeParse({ headline: 42, media: { src: "/x" } }).success).toBe(false);
    expect(contactCtaSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("exposes exactly the section types the registry renders", async () => {
    const { sectionRegistry } = await import("./registry");
    expect(Object.keys(sectionRegistry).sort()).toEqual(Object.keys(sectionSchemas).sort());
  });
});

describe("legacy work-grid data (#28)", () => {
  it("turns the old default chip list into 'auto' and a custom list into label slugs", async () => {
    const { upgradeSectionData } = await import("./schemas");
    const old = { label: "Work", categories: ["All", "Commercial", "Fashion", "Film", "Documentary"] };
    expect(workGridSchema.parse(upgradeSectionData("workGrid", old))).toMatchObject({ labels: "auto" });
    const custom = { categories: ["Everything", "Music Video", "Fashion"] };
    expect(workGridSchema.parse(upgradeSectionData("workGrid", custom)).labels).toEqual(["music-video", "fashion"]);
  });

  it("gives each stored project its old category as its only label", async () => {
    const { upgradeSectionData } = await import("./schemas");
    const out = upgradeSectionData("workGrid", {
      projects: [{ slug: "a", title: "A", format: "F", year: 2024, category: "Fashion Film", cover: { src: "/a.webp" } }],
    }) as { projects: { labels: unknown[] }[] };
    expect(out.projects[0]!.labels).toEqual([{ name: "Fashion Film", slug: "fashion-film" }]);
    expect(out.projects[0]).not.toHaveProperty("category");
  });

  it("leaves other sections and already-upgraded data alone", async () => {
    const { upgradeSectionData } = await import("./schemas");
    const hero = { headline: "x" };
    expect(upgradeSectionData("hero", hero)).toBe(hero);
    expect(upgradeSectionData("workGrid", { labels: ["fashion"] })).toEqual({ labels: ["fashion"] });
  });
});
