import { describe, expect, it } from "vitest";
import { browserOf, deviceOf, isBot } from "./ua";
import { createVideoTracker, type VideoMilestone } from "./video";

const UA = {
  chromeMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  androidTablet: "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
  instagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 355.0.0.0 (iPhone15,2)",
  cubot: "Mozilla/5.0 (Linux; Android 12; Cubot X30 Build/SP1A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
};

describe("isBot", () => {
  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "WhatsApp/2.23.20.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
    "curl/8.4.0",
    "python-requests/2.31.0",
    "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
    "",
  ])("drops %s", (ua) => expect(isBot(ua)).toBe(true));

  it("keeps real browsers, including in-app ones", () => {
    for (const ua of Object.values(UA)) expect(isBot(ua)).toBe(false);
  });
});

describe("deviceOf / browserOf", () => {
  it("classifies devices", () => {
    expect(deviceOf(UA.chromeMac)).toBe("desktop");
    expect(deviceOf(UA.safariIphone)).toBe("mobile");
    expect(deviceOf(UA.ipad)).toBe("tablet");
    expect(deviceOf(UA.androidTablet)).toBe("tablet");
    expect(deviceOf(UA.cubot)).toBe("mobile");
  });

  it("classifies browsers (Edge before Chrome, Chrome before Safari)", () => {
    expect(browserOf(UA.edge)).toBe("Edge");
    expect(browserOf(UA.chromeMac)).toBe("Chrome");
    expect(browserOf(UA.safariIphone)).toBe("Safari");
    expect(browserOf(UA.firefox)).toBe("Firefox");
  });
});

describe("createVideoTracker", () => {
  it("emits play once, each milestone once, and complete at 95%", () => {
    const out: VideoMilestone[] = [];
    const v = createVideoTracker((m) => out.push(m));
    v.time(50, 100); // ignored before play
    v.play();
    v.play();
    v.time(10, 100);
    v.time(30, 100);
    v.time(80, 100); // skipping ahead reports 50 and 75 together
    v.time(96, 100);
    v.time(99, 100);
    expect(out).toEqual([
      { type: "VIDEO_PLAY" },
      { type: "VIDEO_PROGRESS", value: 25 },
      { type: "VIDEO_PROGRESS", value: 50 },
      { type: "VIDEO_PROGRESS", value: 75 },
      { type: "VIDEO_COMPLETE", value: 100 },
    ]);
  });

  it("ignores unknown durations", () => {
    const out: VideoMilestone[] = [];
    const v = createVideoTracker((m) => out.push(m));
    v.play();
    v.time(10, Number.NaN);
    v.time(10, 0);
    expect(out).toHaveLength(1);
  });
});
