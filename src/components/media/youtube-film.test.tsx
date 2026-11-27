import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/features/analytics/track", () => ({ track }));

const { YouTubeFilm } = await import("./youtube-film");

const props = {
  youtubeId: "dQw4w9WgXcQ",
  title: "Night Shift",
  poster: { src: "/media/cover.webp", alt: "Cover" },
  duration: 42,
  aspect: 9 / 16,
  orientation: "portrait" as const,
  priority: true,
};

describe("<YouTubeFilm> facade", () => {
  it("renders only the poster and a labelled button before a click: no iframe, no YouTube request", () => {
    const { container } = render(<YouTubeFilm {...props} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.innerHTML).not.toMatch(/youtube|ytimg|google/);
    expect(screen.getByRole("button", { name: "Play film · 0:42: Night Shift" })).toBeInTheDocument();
    expect(screen.getByAltText("Cover")).toHaveAttribute("data-preload", "true");
  });

  it("sizes the box to the film's shape", () => {
    const { container } = render(<YouTubeFilm {...props} />);
    const box = container.firstElementChild as HTMLElement;
    expect(box.style.aspectRatio).toMatch(/^0.5625/);
    expect(box.dataset.orientation).toBe("portrait");
  });

  it("warms connections on hover, then swaps in the privacy-enhanced embed on click", () => {
    const { container } = render(<YouTubeFilm {...props} start={5} />);
    const button = screen.getByRole("button");
    fireEvent.pointerEnter(button);
    expect(document.head.querySelector('link[rel="preconnect"][href="https://www.youtube-nocookie.com"]')).not.toBeNull();
    fireEvent.click(button);
    const iframe = container.querySelector("iframe")!;
    const src = new URL(iframe.src);
    expect(src.origin).toBe("https://www.youtube-nocookie.com");
    expect(src.pathname).toBe("/embed/dQw4w9WgXcQ");
    expect(src.searchParams.get("autoplay")).toBe("1");
    expect(src.searchParams.get("playsinline")).toBe("1");
    expect(src.searchParams.get("enablejsapi")).toBe("1");
    expect(src.searchParams.get("start")).toBe("5");
    expect(src.searchParams.get("origin")).toBe(window.location.origin);
    expect(iframe).toHaveAttribute("title", "Night Shift");
    expect(iframe.getAttribute("allow")).toContain("autoplay");
    expect(iframe).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reports PLAY from the player's messages, and ignores messages from other windows", () => {
    const { container } = render(<YouTubeFilm {...props} />);
    fireEvent.click(screen.getByRole("button"));
    const iframe = container.querySelector("iframe")!;
    const data = JSON.stringify({ event: "onStateChange", info: 1 });
    window.dispatchEvent(new MessageEvent("message", { origin: "https://www.youtube-nocookie.com", data, source: window }));
    expect(track).not.toHaveBeenCalled();
    window.dispatchEvent(
      new MessageEvent("message", { origin: "https://www.youtube-nocookie.com", data, source: iframe.contentWindow }),
    );
    expect(track).toHaveBeenCalledWith("VIDEO_PLAY", {});
  });
});
