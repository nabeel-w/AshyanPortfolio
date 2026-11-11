import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { site } from "@/content/fallback";
import { JsonLd, personJsonLd, websiteJsonLd } from "./json-ld";

const parse = (container: HTMLElement) =>
  JSON.parse(container.querySelector('script[type="application/ld+json"]')!.innerHTML);

describe("JSON-LD", () => {
  it("describes Ashyan as a Person with profiles linked via sameAs", () => {
    const { container } = render(<JsonLd data={personJsonLd(site)} />);
    expect(parse(container)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": "http://localhost:3000/#person",
      name: site.name,
      jobTitle: site.role,
      sameAs: site.socials.map((s) => s.href),
    });
  });

  it("links the WebSite publisher to the Person entity", () => {
    const { container } = render(<JsonLd data={websiteJsonLd(site)} />);
    expect(parse(container).publisher).toEqual({ "@id": "http://localhost:3000/#person" });
  });

  it("escapes < so content can never close the script tag", () => {
    const evil = { ...site, description: "</script><script>alert(1)</script>" };
    const { container } = render(<JsonLd data={personJsonLd(evil)} />);
    const raw = container.querySelector("script")!.innerHTML;
    expect(raw).not.toContain("</script>");
    expect(raw).toContain("\\u003c/script>");
    expect(parse(container).description).toBe(evil.description);
    expect(container.querySelectorAll("script")).toHaveLength(1);
  });
});
