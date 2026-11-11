import { describe, expect, it, vi } from "vitest";
import { clickEvent } from "./track";

const origin = "http://localhost:3000";
function el(html: string) {
  document.body.innerHTML = html;
  return document.body.querySelector("[data-target]") as Element;
}

describe("clickEvent", () => {
  it("reads data-cta from the clicked element or an ancestor", () => {
    expect(clickEvent(el('<a href="/contact" data-cta="hero"><span data-target>Talk</span></a>'), origin)).toEqual({ t: "CTA_CLICK", l: "hero" });
  });

  it("labels mailto/tel and external links", () => {
    expect(clickEvent(el('<a data-target href="mailto:a@b.com">x</a>'), origin)).toEqual({ t: "CTA_CLICK", l: "email" });
    expect(clickEvent(el('<a data-target href="tel:+1">x</a>'), origin)).toEqual({ t: "CTA_CLICK", l: "phone" });
    expect(clickEvent(el('<a data-target href="https://www.instagram.com/ashyan">x</a>'), origin)).toEqual({ t: "OUTBOUND_CLICK", l: "instagram.com" });
  });

  it("ignores internal links and non-links", () => {
    expect(clickEvent(el('<a data-target href="/work">x</a>'), origin)).toBeNull();
    expect(clickEvent(el("<p data-target>x</p>"), origin)).toBeNull();
    expect(clickEvent(null, origin)).toBeNull();
  });
});

describe("track", () => {
  it("sends the referrer and query only with the first pageview", async () => {
    vi.resetModules();
    const { track } = await import("./track");
    const beacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: beacon });
    Object.defineProperty(document, "referrer", { value: "https://chatgpt.com/", configurable: true });
    window.history.pushState({}, "", "/work?utm_source=x");

    track("PAGEVIEW");
    track("PAGEVIEW");
    track("CTA_CLICK", { l: "hero" });
    const bodies = beacon.mock.calls.map((c) => JSON.parse((c as unknown[])[1] as string));
    expect(bodies[0]).toEqual({ t: "PAGEVIEW", p: "/work", r: "https://chatgpt.com/", q: "?utm_source=x" });
    expect(bodies[1]).toEqual({ t: "PAGEVIEW", p: "/work" });
    expect(bodies[2]).toEqual({ t: "CTA_CLICK", p: "/work", l: "hero" });
  });
});
