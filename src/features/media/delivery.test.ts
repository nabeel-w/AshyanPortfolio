import { describe, expect, it } from "vitest";
import { clockDuration, isoDuration, mux } from "./delivery";

describe("duration formatting", () => {
  it.each([
    [0, "PT0S"],
    [20.1, "PT20S"],
    [125.4, "PT2M5S"],
    [3600, "PT1H"],
    [3725, "PT1H2M5S"],
  ])("isoDuration(%s) = %s", (s, iso) => expect(isoDuration(s)).toBe(iso));

  it.each([
    [20.1, "0:20"],
    [125.4, "2:05"],
    [3725, "1:02:05"],
  ])("clockDuration(%s) = %s", (s, clock) => expect(clockDuration(s)).toBe(clock));
});

describe("mux URLs", () => {
  it("builds poster, HLS and MP4 rendition URLs", () => {
    expect(mux.poster("pb", 2, 640)).toBe("https://image.mux.com/pb/thumbnail.webp?time=2&width=640");
    expect(mux.hls("pb")).toBe("https://stream.mux.com/pb.m3u8");
    expect(mux.mp4("pb")).toBe("https://stream.mux.com/pb/highest.mp4");
  });
});
