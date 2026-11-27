import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { homeSections } from "@/content/fallback";
import type { SectionData, SectionProps } from "@/features/sections/schemas";
import { SectionRenderer } from "@/features/sections/registry";
import { ClientMarquee } from "./client-marquee";
import { ContactCta } from "./contact-cta";
import { Hero } from "./hero";
import { WorkGrid } from "./work-grid";

const data = <T extends SectionData["type"]>(type: T) =>
  homeSections.find((s) => s.type === type)!.data as SectionProps<T>;

describe("<Hero>", () => {
  it("renders the headline as the page h1 with the red accent", () => {
    render(<Hero {...data("hero")} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("Crafting visual stories through edit.");
    expect(within(h1).getByText("through edit.").tagName).toBe("EM");
  });

  it("preloads the hero image as the LCP element at high quality", () => {
    render(<Hero {...data("hero")} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/media/hero.webp");
    expect(img).toHaveAttribute("data-preload", "true");
    expect(img).toHaveAttribute("data-fetchpriority", "high");
    expect(img).toHaveAttribute("data-quality", "90");
    expect(img.getAttribute("alt")).not.toBe("");
  });

  it("links the CTA to the work section", () => {
    render(<Hero {...data("hero")} />);
    expect(screen.getByRole("link", { name: /view selected work/i })).toHaveAttribute(
      "href",
      "#work",
    );
  });
});

describe("<WorkGrid>", () => {
  const props = data("workGrid");

  const cards = (container: HTMLElement) => [...container.querySelectorAll("article")];

  it("gives every card one title link to its film page (a stretched link)", () => {
    const { container } = render(<WorkGrid {...props} />);
    const titles = cards(container).map((a) => within(a).getByRole("heading", { level: 3 }).querySelector("a")!);
    expect(titles.map((l) => l.getAttribute("href"))).toEqual(props.projects.map((p) => `/work/${p.slug}`));
    expect(titles[0]!.className).toContain("after:inset-0");
  });

  it("shows the index, title, label tags (as links) and year on each card", () => {
    const { container } = render(<WorkGrid {...props} />);
    const first = cards(container)[0]!;
    expect(first).toHaveTextContent("01");
    expect(first).toHaveTextContent("The Next Chapter");
    expect(first).toHaveTextContent("2024");
    expect(within(first).getByRole("link", { name: "Commercial" })).toHaveAttribute("href", "/work/label/commercial");
  });

  it("never nests a link inside another link (#28)", () => {
    const { container } = render(<WorkGrid {...props} />);
    expect(container.querySelectorAll("a a")).toHaveLength(0);
  });

  it("marks each frame as a blade-cursor PLAY target and the article as the hover-loop scope", () => {
    const { container } = render(<WorkGrid {...props} />);
    for (const card of cards(container)) {
      expect(card).toHaveAttribute("data-loop-scope");
      expect(card.querySelector('[data-cursor="play"]')).not.toBeNull();
    }
  });

  it("tags each item with its label slugs for in-place filtering", () => {
    const { container } = render(<WorkGrid {...props} />);
    expect([...container.querySelectorAll("li[data-labels]")].map((li) => li.getAttribute("data-labels"))).toEqual(
      props.projects.map((p) => p.labels.map((l) => l.slug).join(" ")),
    );
  });

  it("loads the first row eagerly, the rest lazily, and preloads only the first tile above the fold", () => {
    const { rerender } = render(<WorkGrid {...props} />);
    expect(screen.getAllByRole("img").map((i) => i.getAttribute("loading"))).toEqual([
      "eager",
      "eager",
      "eager",
      "lazy",
      "lazy",
      "lazy",
      "lazy",
    ]);
    expect(screen.getAllByRole("img").filter((i) => i.getAttribute("data-preload") === "true")).toHaveLength(0);
    rerender(<WorkGrid {...props} position={1} />);
    const preloaded = screen.getAllByRole("img").filter((i) => i.getAttribute("data-preload") === "true");
    expect(preloaded).toHaveLength(1);
    expect(preloaded[0]).toHaveAttribute("data-fetchpriority", "high");
  });

  it("gives each film a bento tile from its shape: feature, tall reels, wide long-form (#29)", () => {
    const { container } = render(<WorkGrid {...props} />);
    expect([...container.querySelectorAll("article")].map((a) => a.dataset.tile)).toEqual([
      "feature",
      "tall",
      "tall",
      "wide",
      "wide",
      "wide",
      "wide",
    ]);
    const items = [...container.querySelectorAll("ul.bento > li")];
    expect(items[0]).toHaveClass("col-span-2", "lg:row-span-2");
    expect(items[1]).toHaveClass("row-span-2");
    expect(items[3]).toHaveClass("col-span-2");
    // Portrait reels get portrait-sized images, not a 16:9 crop
    expect(container.querySelectorAll("img")[1]).toHaveAttribute("sizes", "(min-width: 1024px) 25vw, 50vw");
  });

  it("shows at most `limit` films with an All work link when there are more", () => {
    render(<WorkGrid {...props} limit={3} />);
    expect(document.querySelectorAll("article")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /All work · 07 films/ })).toHaveAttribute("href", "/work");
    expect(document.querySelector("[data-work-count]")).toHaveTextContent("03");
  });

  it("renders label chips as real links with counts (no JS needed)", () => {
    render(<WorkGrid {...props} />);
    const nav = screen.getByRole("navigation", { name: /filter work/i });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/work",
      "/work/label/commercial",
      "/work/label/reels",
      "/work/label/fashion",
      "/work/label/music-video",
      "/work/label/film",
      "/work/label/documentary",
    ]);
    expect(within(nav).getByRole("link", { name: /Commercial/ })).toHaveTextContent("02");
    expect(within(nav).getByRole("link", { name: /Commercial/ })).toHaveAttribute("data-cta", "label:commercial");
    // On the home teaser no chip is "current": they navigate to label pages.
    expect(nav.querySelector("[aria-current]")).toBeNull();
  });

  it("marks the active chip on a label page", () => {
    render(<WorkGrid {...props} activeLabel="fashion" />);
    const nav = screen.getByRole("navigation", { name: /filter work/i });
    expect(within(nav).getByRole("link", { name: /Fashion/ })).toHaveAttribute("aria-current", "page");
  });

  it("uses the black tone by default and paper when asked", () => {
    const { container, rerender } = render(<WorkGrid {...props} tone="ink" />);
    expect(container.querySelector("section")).toHaveClass("bg-ink");
    rerender(<WorkGrid {...props} tone="paper" />);
    expect(container.querySelector("section")).toHaveClass("tone-paper");
  });

  it("splits the label so the last word is the red italic accent", () => {
    render(<WorkGrid {...props} />);
    expect(screen.getByRole("heading", { level: 2 }).querySelector("em")).toHaveTextContent("work");
  });
});

describe("<ClientMarquee>", () => {
  const props = data("clientMarquee");

  it("renders the list twice for a seamless loop, hiding the copy from screen readers", () => {
    const { container } = render(<ClientMarquee {...props} />);
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(props.clients.length * 2);
    expect([...items].filter((li) => li.getAttribute("aria-hidden") === "true")).toHaveLength(
      props.clients.length,
    );
  });

  it("sets the loop duration from the speed prop", () => {
    const { container } = render(<ClientMarquee {...props} speed={30} />);
    expect(
      (container.querySelector("ul") as HTMLElement).style.getPropertyValue("--marquee-duration"),
    ).toBe("30s");
  });

  it("shows a logo image when provided, otherwise the wordmark", () => {
    render(
      <ClientMarquee
        label="Trusted by"
        speed={40}
        clients={[{ name: "Sony", logo: { src: "/sony.svg", alt: "" } }, { name: "Zara" }]}
      />,
    );
    expect(screen.getAllByAltText("Sony")[0]).toHaveAttribute("src", "/sony.svg");
    expect(screen.getAllByText("Zara")[0]).toBeInTheDocument();
  });

  it("shows the section label but never a client count", () => {
    const { container } = render(<ClientMarquee {...props} label="Trusted by" />);
    expect(screen.getByText("Trusted by")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/d+s*Clients/i);
  });

  it("renders nothing without clients", () => {
    const { container } = render(<ClientMarquee label="x" speed={40} clients={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("<ContactCta>", () => {
  it("links to the email with a mailto", () => {
    render(<ContactCta {...data("contactCta")} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "mailto:hello@ashyanzafar.com");
  });
});

describe("<SectionRenderer>", () => {
  it("renders every home section in order with data attributes for the editor", () => {
    const { container } = render(<SectionRenderer sections={homeSections} />);
    const wrappers = container.querySelectorAll("[data-section-type]");
    expect([...wrappers].map((w) => w.getAttribute("data-section-type"))).toEqual(
      homeSections.map((s) => s.type),
    );
    expect(wrappers[0]).toHaveAttribute("data-section-id", homeSections[0]!.id);
  });

  it("skips hidden sections", () => {
    const sections = homeSections.map((s) =>
      s.type === "statement" ? { ...s, visible: false } : s,
    );
    const { container } = render(<SectionRenderer sections={sections} />);
    expect(container.querySelector('[data-section-type="statement"]')).toBeNull();
  });

  it("has exactly one h1 on the page", () => {
    render(<SectionRenderer sections={homeSections} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
