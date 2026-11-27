import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AssetSummary } from "@/features/media/summary";

vi.mock("@/features/media/actions", () => ({ listAssetsAction: vi.fn(async () => []), completeUploadAction: vi.fn() }));
vi.mock("@/features/media/client/upload", () => ({ uploadFile: vi.fn() }));

const { AssetField, loopWarnings } = await import("./asset-field");
const { AssetThumb } = await import("./media-picker");

const loop: AssetSummary = {
  id: "a1",
  kind: "VIDEO",
  status: "READY",
  provider: "vercel-blob",
  filename: "loop.mp4",
  url: "https://x.public.blob.vercel-storage.com/video/loop.mp4",
  alt: "",
  width: 720,
  height: 1280,
  blurDataUrl: null,
  playbackId: null,
  duration: 4,
  bytes: 3 * 1024 * 1024,
  createdAt: "2026-11-27T00:00:00.000Z",
  import: null,
};

describe("admin media thumbnails (#26)", () => {
  it("shows a Blob video's own first frame, with no request to a video host", () => {
    const { container } = render(<AssetThumb asset={loop} />);
    const video = container.querySelector("video")!;
    expect(video.getAttribute("src")).toBe(`${loop.url}#t=0.5`);
    expect(video).toHaveAttribute("preload", "metadata");
    expect(container.innerHTML).not.toMatch(/mux/);
  });

  it("shows images as <img>", () => {
    const { container } = render(<AssetThumb asset={{ kind: "IMAGE", url: "https://cdn/x.webp" }} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn/x.webp");
  });
});

describe("loop warnings", () => {
  it("is quiet for a good loop", () => {
    expect(loopWarnings(loop)).toEqual([]);
    expect(loopWarnings(null)).toEqual([]);
  });

  it("warns (never blocks) about long, heavy or oversized loops", () => {
    expect(loopWarnings({ ...loop, duration: 12, bytes: 12 * 1024 * 1024, width: 2160, height: 3840 })).toHaveLength(3);
    render(<AssetField label="Hover preview" kind="VIDEO" purpose="loop" asset={{ ...loop, duration: 12 }} onChange={() => {}} />);
    expect(screen.getByText(/runs 12 s/)).toBeInTheDocument();
  });
});
