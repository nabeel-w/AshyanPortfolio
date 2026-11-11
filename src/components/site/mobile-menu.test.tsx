import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MobileMenu } from "./mobile-menu";

const items = [
  { label: "Work", href: "/#work" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/#contact" },
];

const setup = () => {
  render(<MobileMenu items={items} email="hello@ashyan.test" />);
  return { user: userEvent.setup(), toggle: screen.getByRole("button") };
};

describe("<MobileMenu>", () => {
  it("starts closed", () => {
    const { toggle } = setup();
    expect(toggle).toHaveTextContent("Menu");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Mobile" })).toBeNull();
  });

  it("opens a full-screen menu with numbered links and the email", async () => {
    const { user, toggle } = setup();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("Close");
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "01Work",
      "02About",
      "03Contact",
      "hello@ashyan.test",
    ]);
    expect(links.at(-1)).toHaveAttribute("href", "mailto:hello@ashyan.test");
  });

  it("locks page scroll while open and restores it when closed", async () => {
    const { user, toggle } = setup();
    await user.click(toggle);
    expect(document.documentElement.style.overflow).toBe("hidden");
    await user.click(toggle);
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("closes on Escape", async () => {
    const { user, toggle } = setup();
    await user.click(toggle);
    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("closes after choosing a link", async () => {
    const { user, toggle } = setup();
    await user.click(toggle);
    await user.click(screen.getByRole("link", { name: /about/i }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("has a 44px+ tap target for the toggle", () => {
    const { toggle } = setup();
    expect(toggle).toHaveClass("min-h-11");
  });
});
