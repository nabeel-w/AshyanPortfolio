import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "../../../test/dom-utils";
import { Timecode } from "./timecode";

/** Drive requestAnimationFrame by hand so frames are deterministic. */
function controlledRaf() {
  let next: FrameRequestCallback | null = null;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    next = cb;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(performance, "now").mockReturnValue(0);
  return (ms: number) => act(() => next?.(ms));
}

const clock = (container: HTMLElement) => container.querySelectorAll("span span")[1]!.textContent;

describe("<Timecode>", () => {
  beforeEach(() => mockMatchMedia(() => false));

  it("starts at 00:00:00:00 with a REC marker", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    const { container } = render(<Timecode />);
    expect(container).toHaveTextContent("● REC");
    expect(clock(container)).toBe("00:00:00:00");
  });

  it("counts SMPTE frames at 24fps", () => {
    const frame = controlledRaf();
    const { container } = render(<Timecode />);
    frame((1000 / 24) * 5 + 1); // 5 frames
    expect(clock(container)).toBe("00:00:00:05");
    frame(61_500); // 1 min 1.5 s
    expect(clock(container)).toBe("00:01:01:12");
  });

  it("stays still for reduced-motion users", () => {
    mockMatchMedia((q) => q.includes("reduce"));
    const raf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    render(<Timecode />);
    expect(raf).not.toHaveBeenCalled();
  });

  it("is hidden from assistive tech (decorative)", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    const { container } = render(<Timecode />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
