import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
  it("shows only the chosen category and restores everything with the first chip", async () => {
    const user = userEvent.setup();
    const props = data(homeSections, "workGrid");
    const { container } = render(<WorkGrid {...props} />);
    const items = () => [...container.querySelectorAll<HTMLElement>("li[data-category]")];
    const nav = screen.getByRole("navigation", { name: /filter work/i });

    await user.click(within(nav).getByRole("button", { name: "Fashion" }));
    expect(within(nav).getByRole("button", { name: "Fashion" })).toHaveAttribute("aria-pressed", "true");
    expect(items().filter((li) => !li.hidden).map((li) => li.dataset.category)).toEqual(["Fashion"]);

    await user.click(within(nav).getByRole("button", { name: "All" }));
    expect(items().every((li) => !li.hidden)).toBe(true);
  });
});
