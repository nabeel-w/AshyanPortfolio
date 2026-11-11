import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WhatsAppButton, whatsappHref } from "./whatsapp-button";

describe("whatsappHref", () => {
  it("keeps digits only and encodes the prefilled message", () => {
    expect(whatsappHref("+91 83349 08607")).toBe("https://wa.me/918334908607");
    expect(whatsappHref("+91 83349 08607", "Hi Ashyan & team?")).toBe(
      "https://wa.me/918334908607?text=Hi%20Ashyan%20%26%20team%3F",
    );
  });
});

describe("<WhatsAppButton>", () => {
  const setScroll = (y: number) => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    act(() => void fireEvent.scroll(window));
  };

  it("opens WhatsApp in a new tab with an accessible name", () => {
    render(<WhatsAppButton phone="+91 83349 08607" message="Hello" />);
    const link = screen.getByRole("link", { name: /chat with ashyan on whatsapp/i });
    expect(link).toHaveAttribute("href", "https://wa.me/918334908607?text=Hello");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("stays hidden over the hero and fades in after scrolling", () => {
    setScroll(0);
    render(<WhatsAppButton phone="+91 83349 08607" />);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("opacity-0", "pointer-events-none");
    setScroll(window.innerHeight);
    expect(link).toHaveClass("opacity-100");
    expect(link).not.toHaveClass("pointer-events-none");
  });

  it("uses the brand red and a 56px tap target", () => {
    render(<WhatsAppButton phone="1" />);
    const circle = screen.getByRole("link").querySelector(".size-14");
    expect(circle).toHaveClass("bg-red", "rounded-full");
  });
});
