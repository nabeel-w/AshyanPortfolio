import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { pageSections, site } from "@/content/fallback";
import { Faq } from "@/components/site/faq";
import type { SectionProps } from "@/features/sections/schemas";
import robots from "@/app/robots";
import { faqJsonLd, personJsonLd, profilePageJsonLd, profileUrls, projectJsonLd } from "./json-ld";

const faq = pageSections.about.find((s) => s.type === "faq")!.data as SectionProps<"faq">;

describe("sameAs profile URLs", () => {
  it("keeps real profiles and drops bare platform domains", () => {
    expect(
      profileUrls([
        { href: "https://vimeo.com/ashyanzafar" },
        { href: "https://instagram.com/" },
        { href: "https://www.linkedin.com" },
        { href: "https://www.imdb.com/name/nm0000001/" },
        { href: "not a url" },
        { href: "javascript:alert(1)" },
      ]),
    ).toEqual(["https://vimeo.com/ashyanzafar", "https://www.imdb.com/name/nm0000001/"]);
  });

  it("the placeholder socials (bare domains) are not claimed as Ashyan's profiles", () => {
    expect((personJsonLd(site) as { sameAs?: unknown }).sameAs).toEqual([]);
  });
});

describe("FAQ (GEO)", () => {
  it("placeholder answers stay within the 40–60 word guideline", () => {
    for (const item of faq.items) {
      const words = item.answer.split(/\s+/).length;
      expect(words, item.question).toBeGreaterThanOrEqual(40);
      expect(words, item.question).toBeLessThanOrEqual(60);
      expect(item.question.trim().endsWith("?")).toBe(true);
    }
  });

  it("renders every question as a visible heading with its answer (no hidden text)", () => {
    render(<Faq {...faq} />);
    for (const item of faq.items) {
      expect(screen.getByRole("heading", { level: 3, name: item.question })).toBeVisible();
      expect(screen.getByText(item.answer)).toBeVisible();
    }
  });

  it("FAQPage JSON-LD mirrors the visible Q&A exactly", () => {
    const ld = faqJsonLd(faq.items, "https://ashyan.test/about");
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toEqual(
      faq.items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })),
    );
  });

  it("renders nothing without questions", () => {
    const { container } = render(<Faq eyebrow="Q" title="T" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ProfilePage + VideoObject", () => {
  it("/about is a ProfilePage about the same #person entity", () => {
    const ld = profilePageJsonLd(site);
    expect(ld).toMatchObject({ "@type": "ProfilePage", mainEntity: { "@id": "http://localhost:3000/#person" } });
  });

  it("adds the film transcript to the VideoObject", () => {
    const ld = projectJsonLd(
      {
        slug: "x",
        title: "X",
        format: "Brand Film",
        year: 2024,
        category: "Commercial",
        summary: "S",
        story: [],
        credits: [],
        cover: { src: "/media/x.webp", alt: "" },
        film: { playbackId: "pb", duration: 20, poster: "" },
        transcript: "She looks up. Silence.",
        gallery: [],
      },
      site,
    );
    expect(ld["@graph"][0]).toMatchObject({ "@type": ["VideoObject", "CreativeWork"], transcript: "She looks up. Silence.", duration: "PT20S" });
  });
});

describe("robots.txt policy", () => {
  it("welcomes search and AI crawlers on public pages but keeps private areas closed to all", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    const ai = rules.find((x) => Array.isArray(x.userAgent));
    expect(ai?.userAgent).toEqual(expect.arrayContaining(["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]));
    for (const rule of rules) {
      expect(rule.allow).toBe("/");
      expect(rule.disallow).toEqual(expect.arrayContaining(["/admin", "/api", "/preview", "/login"]));
    }
  });
});
