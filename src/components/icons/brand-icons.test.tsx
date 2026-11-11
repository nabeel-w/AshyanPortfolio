import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SocialIcon } from "@/components/site/social-icon";
import { BrandIcon, brandFromUrl } from "./brand-icons";

describe("brandFromUrl", () => {
  it.each([
    ["https://www.instagram.com/ashyan", "instagram"],
    ["https://vimeo.com/ashyanzafar", "vimeo"],
    ["https://youtu.be/abc", "youtube"],
    ["https://www.youtube.com/@ashyan", "youtube"],
    ["https://in.linkedin.com/in/ashyan", "linkedin"],
    ["https://www.imdb.com/name/nm1/", "imdb"],
    ["https://www.behance.net/ashyan", "behance"],
    ["https://wa.me/918334908607", "whatsapp"],
    ["https://chatgpt.com/?q=hi", "chatgpt"],
  ])("%s → %s", (url, brand) => expect(brandFromUrl(url)).toBe(brand));

  it("doesn't match look-alike hosts or junk", () => {
    expect(brandFromUrl("https://notinstagram.com/x")).toBeNull();
    expect(brandFromUrl("https://instagram.com.evil.test/x")).toBeNull();
    expect(brandFromUrl("nope")).toBeNull();
  });
});

describe("icons", () => {
  it("render as decorative currentColor SVGs", () => {
    const { container } = render(<BrandIcon brand="youtube" className="size-4" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelector("path")).toHaveAttribute("fill", "currentColor");
  });

  it("SocialIcon falls back to an arrow for unknown sites", () => {
    expect(render(<SocialIcon href="https://example.com" />).container).toHaveTextContent("↗");
    expect(render(<SocialIcon href="https://vimeo.com/a" />).container.querySelector("svg")).toBeInTheDocument();
  });
});
