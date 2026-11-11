import { describe, expect, it } from "vitest";
import { classifySource, parseUtm, referrerHost } from "./source";

const site = ["ashyanzafar.com", "localhost"];
const c = (referrer?: string, search?: string) => classifySource({ referrer, utm: parseUtm(search), internalHosts: site });

describe("classifySource", () => {
  it.each([
    ["https://chatgpt.com/", "AI"],
    ["https://chat.openai.com/c/123", "AI"],
    ["https://www.perplexity.ai/search?q=film+editor", "AI"],
    ["https://claude.ai/chat/abc", "AI"],
    ["https://gemini.google.com/app", "AI"],
    ["https://copilot.microsoft.com/", "AI"],
    ["https://kagi.com/assistant/xyz", "AI"],
  ])("AI assistants: %s → %s", (ref, expected) => expect(c(ref)).toBe(expected));

  it.each([
    ["https://www.google.com/", "SEARCH"],
    ["https://www.google.co.uk/", "SEARCH"],
    ["https://www.bing.com/search?q=x", "SEARCH"],
    ["https://duckduckgo.com/", "SEARCH"],
    ["https://kagi.com/search?q=x", "SEARCH"],
    ["https://yandex.ru/", "SEARCH"],
  ])("search engines: %s → %s", (ref, expected) => expect(c(ref)).toBe(expected));

  it.each([
    ["https://l.instagram.com/?u=x", "SOCIAL"],
    ["https://t.co/abc", "SOCIAL"],
    ["https://www.linkedin.com/feed/", "SOCIAL"],
    ["https://vimeo.com/123", "SOCIAL"],
    ["https://mail.google.com/mail/u/0/", "EMAIL"],
    ["https://outlook.live.com/", "EMAIL"],
    ["https://someblog.example/post", "REFERRAL"],
    ["https://notgoogle.com/", "REFERRAL"],
  ])("%s → %s", (ref, expected) => expect(c(ref)).toBe(expected));

  it("treats no referrer as direct and our own host as internal (null)", () => {
    expect(c(undefined)).toBe("DIRECT");
    expect(c("not a url")).toBe("DIRECT");
    expect(c("https://ashyanzafar.com/work")).toBeNull();
    expect(c("https://www.ashyanzafar.com/")).toBeNull();
    expect(c("http://localhost:3000/about")).toBeNull();
  });

  it("maps Android app referrers", () => {
    expect(c("android-app://com.google.android.gm/")).toBe("EMAIL");
    expect(c("android-app://com.openai.chatgpt/")).toBe("AI");
    expect(c("android-app://com.linkedin.android/")).toBe("SOCIAL");
    expect(c("android-app://com.unknown.app/")).toBe("REFERRAL");
  });

  it("lets UTM tags win over the referrer", () => {
    expect(c("https://www.google.com/", "?utm_source=chatgpt.com")).toBe("AI");
    expect(c(undefined, "?utm_source=google&utm_medium=cpc")).toBe("PAID");
    expect(c(undefined, "?utm_source=newsletter&utm_medium=email")).toBe("EMAIL");
    expect(c(undefined, "?utm_source=instagram&utm_medium=social")).toBe("SOCIAL");
    expect(c(undefined, "?utm_source=perplexity")).toBe("AI");
    expect(c(undefined, "?utm_source=festival-site")).toBe("REFERRAL");
    expect(c("https://chatgpt.com/", "?ref=x")).toBe("AI"); // non-UTM params are ignored
  });
});

describe("referrerHost / parseUtm", () => {
  it("strips www and rejects non-URLs", () => {
    expect(referrerHost("https://www.Google.com/search")).toBe("google.com");
    expect(referrerHost("javascript:alert(1)")).toBeNull();
    expect(referrerHost("")).toBeNull();
  });

  it("clips UTM values", () => {
    expect(parseUtm("utm_campaign=" + "x".repeat(300)).campaign).toHaveLength(100);
    expect(parseUtm(null)).toEqual({});
  });
});
