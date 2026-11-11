import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../../test/dom-utils";
import { BladeCursor } from "./blade-cursor";

afterEach(() => {
  delete document.documentElement.dataset.cursor;
  document.querySelectorAll(".blade-cut").forEach((n) => n.remove());
});

describe("<BladeCursor>", () => {
  it("takes over the cursor on mouse/trackpad devices", () => {
    mockMatchMedia((q) => q.includes("pointer: fine"));
    render(<BladeCursor />);
    expect(document.documentElement.dataset.cursor).toBe("blade");
  });

  it("does nothing on touch devices", () => {
    mockMatchMedia(() => false);
    render(<BladeCursor />);
    expect(document.documentElement.dataset.cursor).toBeUndefined();
  });

  it("does nothing for reduced-motion users", () => {
    mockMatchMedia((q) => q.includes("pointer: fine") || q.includes("reduce"));
    render(<BladeCursor />);
    expect(document.documentElement.dataset.cursor).toBeUndefined();
  });

  it("restores the system cursor on unmount", () => {
    mockMatchMedia((q) => q.includes("pointer: fine"));
    const { unmount } = render(<BladeCursor />);
    unmount();
    expect(document.documentElement.dataset.cursor).toBeUndefined();
  });

  it("leaves a red cut mark on click that removes itself", () => {
    mockMatchMedia((q) => q.includes("pointer: fine"));
    render(<BladeCursor />);
    fireEvent.pointerDown(window, { clientX: 120, clientY: 80 });
    const cut = document.querySelector<HTMLElement>(".blade-cut")!;
    expect(cut).toBeInTheDocument();
    expect(cut.style.left).toBe("120px");
    expect(cut.style.top).toBe("80px");
    fireEvent.animationEnd(cut);
    expect(document.querySelector(".blade-cut")).toBeNull();
  });

  it("shows the PLAY ring over [data-cursor=play] targets", () => {
    mockMatchMedia((q) => q.includes("pointer: fine"));
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    const { container } = render(
      <>
        <a href="/work/x" data-cursor="play">
          film
        </a>
        <BladeCursor />
      </>,
    );
    const ring = container.querySelector<HTMLElement>(".blade-ring")!;
    fireEvent.pointerMove(container.querySelector("a")!, { clientX: 10, clientY: 10 });
    expect(ring.dataset.active).toBe("true");
    fireEvent.pointerMove(document.body, { clientX: 300, clientY: 300 });
    expect(ring.dataset.active).toBe("false");
  });

  it("is invisible to assistive tech", () => {
    const { container } = render(<BladeCursor />);
    for (const el of container.children) expect(el).toHaveAttribute("aria-hidden", "true");
  });
});
