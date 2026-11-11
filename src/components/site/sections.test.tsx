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

  it("lists every project as a link to its film page", () => {
    render(<WorkGrid {...props} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(props.projects.length);
    expect(links.map((l) => l.getAttribute("href"))).toEqual(
      props.projects.map((p) => `/work/${p.slug}`),
    );
  });

  it("shows title, format · year and a zero-padded index for each card", () => {
    render(<WorkGrid {...props} />);
    const first = screen.getAllByRole("link")[0]!;
    expect(within(first).getByRole("heading", { level: 3 })).toHaveTextContent("The Next Chapter");
    expect(first).toHaveTextContent("Brand Film · 2024");
    expect(first).toHaveTextContent("01");
  });

  it("marks cards as blade-cursor PLAY targets", () => {
    render(<WorkGrid {...props} />);
    for (const link of screen.getAllByRole("link"))
      expect(link).toHaveAttribute("data-cursor", "play");
  });

  it("loads the first two covers eagerly and the rest lazily", () => {
    render(<WorkGrid {...props} />);
    expect(screen.getAllByRole("img").map((i) => i.getAttribute("loading"))).toEqual([
      "eager",
      "eager",
      "lazy",
      "lazy",
      "lazy",
    ]);
  });

  it("renders the filter chips with the first one active", () => {
    render(<WorkGrid {...props} />);
    const nav = screen.getByRole("navigation", { name: /filter work/i });
    expect(
      within(nav)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(props.categories);
    expect(within(nav).getByText("All")).toHaveClass("text-foreground");
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
