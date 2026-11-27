import { describe, expect, it } from "vitest";
import {
  aspectFor,
  embedUrl,
  orientationFromUrl,
  parseRuntime,
  parseStart,
  parseYouTubeUrl,
  thumbnailUrl,
  watchUrl,
} from "./youtube";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeUrl", () => {
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, { id: ID, kind: "video" }],
    [`https://youtube.com/watch?v=${ID}&list=PL123&index=2`, { id: ID, kind: "video" }],
    [`https://m.youtube.com/watch?v=${ID}`, { id: ID, kind: "video" }],
    [`https://music.youtube.com/watch?v=${ID}`, { id: ID, kind: "video" }],
    [`https://youtu.be/${ID}`, { id: ID, kind: "video" }],
    [`https://youtu.be/${ID}?si=abc123`, { id: ID, kind: "video" }],
    [`https://www.youtube.com/shorts/${ID}`, { id: ID, kind: "short" }],
    [`https://youtube.com/shorts/${ID}?feature=share`, { id: ID, kind: "short" }],
    [`https://www.youtube.com/embed/${ID}`, { id: ID, kind: "video" }],
    [`https://www.youtube-nocookie.com/embed/${ID}?rel=0`, { id: ID, kind: "video" }],
    [`https://www.youtube.com/live/${ID}`, { id: ID, kind: "live" }],
    [`https://www.youtube.com/v/${ID}`, { id: ID, kind: "video" }],
    [`www.youtube.com/watch?v=${ID}`, { id: ID, kind: "video" }],
    [`  youtu.be/${ID}  `, { id: ID, kind: "video" }],
    [`http://www.youtube.com/watch?v=${ID}`, { id: ID, kind: "video" }],
    [`https://WWW.YouTube.com/watch?v=${ID}`, { id: ID, kind: "video" }],
  ])("accepts %s", (input, expected) => {
    expect(parseYouTubeUrl(input)).toEqual(expected);
  });

  it("reads start times in every format", () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?t=90`)).toEqual({ id: ID, kind: "video", start: 90 });
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=1m30s`)?.start).toBe(90);
    expect(parseYouTubeUrl(`https://www.youtube.com/embed/${ID}?start=42`)?.start).toBe(42);
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=nonsense`)?.start).toBeUndefined();
  });

  it.each([
    "",
    "   ",
    "not a url",
    `javascript:alert(1)//youtube.com/watch?v=${ID}`,
    `data:text/html,https://youtu.be/${ID}`,
    `https://youtube.com.evil.io/watch?v=${ID}`,
    `https://evil.io/youtube.com/watch?v=${ID}`,
    `https://notyoutube.com/watch?v=${ID}`,
    `https://youtu.be.evil.io/${ID}`,
    `https://www.youtube.com/playlist?list=PL123`,
    `https://www.youtube.com/watch?list=PL123`,
    `https://www.youtube.com/watch?v=short`,
    `https://www.youtube.com/watch?v=${ID}x`,
    `https://www.youtube.com/watch?v=<script>alert</script>`,
    `https://www.youtube.com/@channel`,
    `https://www.youtube.com/shorts/`,
    `https://user:pass@www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com:8443/watch?v=${ID}`,
    `ftp://www.youtube.com/watch?v=${ID}`,
    `https://vimeo.com/123456`,
  ])("rejects %j", (input) => {
    expect(parseYouTubeUrl(input)).toBeNull();
  });

  it("rejects absurdly long input", () => {
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?x=${"a".repeat(3000)}`)).toBeNull();
  });
});

describe("helpers", () => {
  it("builds privacy-enhanced embed URLs with the facade params", () => {
    const url = new URL(embedUrl(ID, { autoplay: true, origin: "https://ashyan.test", start: 12.7 }));
    expect(url.origin).toBe("https://www.youtube-nocookie.com");
    expect(url.pathname).toBe(`/embed/${ID}`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      autoplay: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
      enablejsapi: "1",
      origin: "https://ashyan.test",
      start: "12",
    });
  });

  it("links Shorts to /shorts/ and everything else to /watch", () => {
    expect(watchUrl(ID, "short")).toBe(`https://www.youtube.com/shorts/${ID}`);
    expect(watchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(thumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/maxresdefault.jpg`);
  });

  it("derives orientation from the link only (Shorts → portrait)", () => {
    expect(orientationFromUrl(`https://youtube.com/shorts/${ID}`)).toBe("portrait");
    expect(orientationFromUrl(`https://youtu.be/${ID}`)).toBe("landscape");
    expect(orientationFromUrl("garbage")).toBe("landscape");
  });

  it("falls back to the orientation's aspect when none (or a silly one) is set", () => {
    expect(aspectFor("portrait")).toBeCloseTo(9 / 16);
    expect(aspectFor("square")).toBe(1);
    expect(aspectFor("landscape", null)).toBeCloseTo(16 / 9);
    expect(aspectFor("landscape", 2.39)).toBe(2.39);
    expect(aspectFor("landscape", 0)).toBeCloseTo(16 / 9);
    expect(aspectFor("portrait", 99)).toBeCloseTo(9 / 16);
  });

  it("parses runtimes and start offsets", () => {
    expect(parseRuntime("2:41")).toBe(161);
    expect(parseRuntime("1:02:03")).toBe(3723);
    expect(parseRuntime("45")).toBe(45);
    expect(parseRuntime("")).toBeNull();
    expect(parseRuntime("1:75")).toBeNull();
    expect(parseRuntime("abc")).toBeNull();
    expect(parseStart("1h2m3s")).toBe(3723);
    expect(parseStart("")).toBeUndefined();
  });
});
