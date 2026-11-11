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
