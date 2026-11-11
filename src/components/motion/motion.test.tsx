import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntroController } from "@/components/site/intro-controller";
import { RevealObserver } from "./reveal-observer";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const root = document.documentElement;

describe("IntroController", () => {
  beforeEach(() => {
    sessionStorage.clear();
    delete root.dataset.intro;
    document.body.innerHTML = '<div data-intro-overlay class="intro"></div>';
  });
  afterEach(() => {
    vi.useRealTimers();
    delete root.dataset.intro;
  });

  it("plays on the first visit of the session and remembers it", () => {
    render(<IntroController />);
    expect(root.dataset.intro).toBe("play");
    expect(sessionStorage.getItem("az-intro")).toBe("1");
  });

  it("stays hidden when the intro was already seen this session", () => {
    sessionStorage.setItem("az-intro", "1");
    render(<IntroController />);
    expect(root.dataset.intro).toBe("seen");
  });

  it("can be skipped with a click or key, then finishes", () => {
    vi.useFakeTimers();
    render(<IntroController />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(root.dataset.intro).toBe("skip");
    vi.advanceTimersByTime(300);
    expect(root.dataset.intro).toBe("done");
  });

  it("never blocks the page: a safety timer ends it even if animations don't run", () => {
    vi.useFakeTimers();
    render(<IntroController />);
    vi.advanceTimersByTime(2600);
    expect(root.dataset.intro).toBe("done");
  });

  it("does nothing on pages without the overlay", () => {
    document.body.innerHTML = "";
    render(<IntroController />);
    expect(root.dataset.intro).toBeUndefined();
  });
});

describe("RevealObserver", () => {
  it("reveals each [data-reveal] element once when it enters the viewport", () => {
    let callback: IntersectionObserverCallback = () => {};
    const observe = vi.fn();
    const unobserve = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(function (this: unknown, cb: IntersectionObserverCallback) {
        callback = cb;
        return { observe, unobserve, disconnect: vi.fn() };
      }),
    );
    document.body.innerHTML = '<p data-reveal id="a"></p><p data-reveal id="b"></p><p data-reveal data-revealed id="c"></p>';
    render(<RevealObserver />);

    expect(observe).toHaveBeenCalledTimes(2); // already-revealed elements are skipped
    const a = document.getElementById("a")!;
    callback([{ isIntersecting: true, target: a } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(a).toHaveAttribute("data-revealed");
    expect(unobserve).toHaveBeenCalledWith(a);
    expect(document.getElementById("b")).not.toHaveAttribute("data-revealed");
  });
});
