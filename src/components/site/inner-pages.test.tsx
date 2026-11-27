import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { homeSections, pageSections, site } from "@/content/fallback";
import type { SectionData, SectionProps } from "@/features/sections/schemas";
import { SectionRenderer } from "@/features/sections/registry";
import { WorkGrid } from "./work-grid";

const about = pageSections.about;
const data = <T extends SectionData["type"]>(list: SectionData[], type: T) => list.find((s) => s.type === type)!.data as SectionProps<T>;

describe("About page sections", () => {
  it("renders header, bio stats, services and client groups", () => {
    render(<SectionRenderer sections={about} site={site} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your next story starts in the edit.");
    for (const s of data(about, "bio").stats) expect(screen.getByText(s.value)).toBeInTheDocument();
    for (const item of data(about, "services").items) {
      expect(screen.getByRole("heading", { level: 3, name: item.title })).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Brands" })).toBeInTheDocument();
  });

  it("splits the bio into paragraphs on blank lines", () => {
    const { container } = render(<SectionRenderer sections={about.filter((s) => s.type === "bio")} />);
    expect(container.querySelectorAll("section p").length).toBe(data(about, "bio").body.split(/\n\s*\n/).length);
  });
});

describe("Contact page sections", () => {
  it("shows the form and contact details from site settings", () => {
    render(<SectionRenderer sections={pageSections.contact} site={site} />);
    expect(screen.getByLabelText(/Name/)).toBeRequired();
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("type", "email");
    expect(screen.getByRole("link", { name: site.email })).toHaveAttribute("href", `mailto:${site.email}`);
    expect(screen.getByRole("link", { name: /chat on whatsapp/i })).toHaveAttribute("href", expect.stringContaining("wa.me/918334908607"));
    expect(screen.getByRole("link", { name: /ask chatgpt/i })).toHaveAttribute("href", expect.stringContaining("chatgpt.com/?q="));
  });

  it("hides the WhatsApp detail when no number is set", () => {
    render(<SectionRenderer sections={pageSections.contact} site={{ ...site, whatsapp: null }} />);
    expect(screen.queryByRole("link", { name: /chat on whatsapp/i })).toBeNull();
  });
});

describe("Work filter", () => {
  const props = () => ({ ...data(homeSections, "workGrid"), chips: "filter" as const });
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("on /work, filters in place, updates the count and the URL, and restores everything with All", async () => {
    window.history.replaceState(null, "", "/work");
    const user = userEvent.setup();
    const { container } = render(<WorkGrid {...props()} />);
    const shown = () => [...container.querySelectorAll<HTMLElement>("li[data-labels]")].filter((li) => !li.hidden);
    const nav = screen.getByRole("navigation", { name: /filter work/i });

    await user.click(within(nav).getByRole("link", { name: /Fashion/ }));
    expect(within(nav).getByRole("link", { name: /Fashion/ })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /All/ })).not.toHaveAttribute("aria-current");
    expect(shown().map((li) => li.dataset.labels)).toEqual(["reels fashion", "fashion"]);
    expect(container.querySelector("[data-work-count]")).toHaveTextContent("02");
    expect(window.location.search).toBe("?label=fashion");
    // Visible films are renumbered from 01, and a near-empty filter shows the "more coming" tile
    expect(shown().map((li) => li.querySelector("[data-work-index]")!.textContent)).toEqual(["01", "02"]);
    expect(container.querySelector("[data-work-empty]")).not.toHaveAttribute("hidden");
    expect(container.querySelector("[data-work-empty-label]")).toHaveTextContent("fashion");

    await user.click(within(nav).getByRole("link", { name: /All/ }));
    expect(shown()).toHaveLength(7);
    expect(container.querySelector("[data-work-count]")).toHaveTextContent("07");
    expect(container.querySelector("[data-work-empty]")).toHaveAttribute("hidden");
    expect(window.location.search).toBe("");
  });

  it("loads already filtered from ?label= and follows the back button", async () => {
    window.history.replaceState(null, "", "/work?label=commercial");
    const { container } = render(<WorkGrid {...props()} />);
    const shown = () => [...container.querySelectorAll<HTMLElement>("li[data-labels]")].filter((li) => !li.hidden);
    expect(shown()).toHaveLength(2);
    window.history.replaceState(null, "", "/work?label=documentary");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(shown().map((li) => li.dataset.labels)).toEqual(["documentary"]);
  });

  it("ignores an unknown ?label= (shows everything)", () => {
    window.history.replaceState(null, "", "/work?label=nope");
    const { container } = render(<WorkGrid {...props()} />);
    expect([...container.querySelectorAll<HTMLElement>("li[data-labels]")].every((li) => !li.hidden)).toBe(true);
  });
});
