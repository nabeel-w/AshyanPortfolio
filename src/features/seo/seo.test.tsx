import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { pageSections, site } from "@/content/fallback";
import { Faq } from "@/components/site/faq";
import type { SectionProps } from "@/features/sections/schemas";
import robots from "@/app/robots";
import { faqJsonLd, labelPageJsonLd, personJsonLd, profilePageJsonLd, profileUrls, projectJsonLd } from "./json-ld";

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

const youtubeFilm = {
  youtubeId: "dQw4w9WgXcQ",
  kind: "video" as const,
  orientation: "landscape" as const,
  aspect: 16 / 9,
  duration: 20,
  poster: { src: "/media/x.webp", alt: "" },
  embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  watchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
};

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
        labels: [],
        related: [],
        summary: "S",
        story: [],
        credits: [],
        cover: { src: "/media/x.webp", alt: "" },
        film: youtubeFilm,
        transcript: "She looks up. Silence.",
        gallery: [],
      },
      site,
    );
    expect(ld["@graph"][0]).toMatchObject({ "@type": ["VideoObject", "CreativeWork"], transcript: "She looks up. Silence.", duration: "PT20S" });
  });

  it("points the VideoObject at the YouTube player, never at a file we don't host (#25)", () => {
    const base = { slug: "x", title: "X", format: "Reel", year: 2024, category: "Fashion", labels: [], related: [], summary: "S", story: [], credits: [], cover: { src: "/media/x.webp", alt: "" }, gallery: [] };
    const work = projectJsonLd({ ...base, film: youtubeFilm }, site)["@graph"][0] as Record<string, unknown>;
    expect(work).toMatchObject({
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      sameAs: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      thumbnailUrl: ["http://localhost:3000/media/x.webp", "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"],
      width: 1920,
      height: 1080,
    });
    expect(work).not.toHaveProperty("contentUrl");
    const reel = projectJsonLd({ ...base, film: { ...youtubeFilm, kind: "short", orientation: "portrait", aspect: 9 / 16 } }, site)["@graph"][0];
    expect(reel).toMatchObject({ width: 1080, height: 1920 });
    expect(projectJsonLd(base, site)["@graph"][0]).toMatchObject({ "@type": "CreativeWork" });
  });
});

describe("labels in structured data (#28)", () => {
  const base = { slug: "x", title: "X", format: "Fashion Film", year: 2024, category: "Fashion", related: [], summary: "S", story: [], credits: [], cover: { src: "/media/x.webp", alt: "" }, gallery: [] };

  it("adds labels as keywords, the primary label as genre, and a label step in the breadcrumb", () => {
    const ld = projectJsonLd({ ...base, labels: [{ name: "Fashion", slug: "fashion", visible: true }, { name: "Reels", slug: "reels", visible: true }] }, site);
    expect(ld["@graph"][0]).toMatchObject({ keywords: "Fashion, Reels", genre: ["Fashion Film", "Fashion"] });
    const crumbs = (ld["@graph"][1] as { itemListElement: { name: string; position: number; item: string }[] }).itemListElement;
    expect(crumbs.map((c) => c.name)).toEqual(["Home", "Work", "Fashion", "X"]);
    expect(crumbs[2]!.item).toBe("http://localhost:3000/work/label/fashion");
    expect(crumbs[3]!.position).toBe(4);
  });

  it("skips hidden labels in the breadcrumb", () => {
    const ld = projectJsonLd({ ...base, labels: [{ name: "Secret", slug: "secret", visible: false }] }, site);
    const crumbs = (ld["@graph"][1] as { itemListElement: { name: string }[] }).itemListElement;
    expect(crumbs.map((c) => c.name)).toEqual(["Home", "Work", "X"]);
  });

  it("describes a label page as a CollectionPage with an ItemList and breadcrumb", () => {
    const ld = labelPageJsonLd({ name: "Fashion", slug: "fashion", description: "Fashion films." }, [
      { slug: "a", title: "A" },
      { slug: "b", title: "B" },
    ]);
    const [page, crumbs] = ld["@graph"] as unknown as [Record<string, unknown>, { itemListElement: { name: string }[] }];
    expect(page).toMatchObject({
      "@type": "CollectionPage",
      url: "http://localhost:3000/work/label/fashion",
      description: "Fashion films.",
      mainEntity: { "@type": "ItemList", numberOfItems: 2, itemListElement: [{ position: 1, url: "http://localhost:3000/work/a" }, { position: 2 }] },
    });
    expect(crumbs.itemListElement.map((c) => c.name)).toEqual(["Home", "Work", "Fashion"]);
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
