import { describe, expect, it, vi } from "vitest";

async function load(url?: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", url ?? "");
  if (url === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  return import("./site-url");
}

describe("absoluteUrl", () => {
  it("joins paths onto the configured site URL without double slashes", async () => {
    const { absoluteUrl, SITE_URL } = await load("https://ashyanzafar.com/");
    expect(SITE_URL).toBe("https://ashyanzafar.com");
    expect(absoluteUrl("/work/x")).toBe("https://ashyanzafar.com/work/x");
    expect(absoluteUrl("work/x")).toBe("https://ashyanzafar.com/work/x");
    expect(absoluteUrl()).toBe("https://ashyanzafar.com/");
  });

  it("defaults to localhost when unset", async () => {
    const { SITE_URL } = await load(undefined);
    expect(SITE_URL).toBe("http://localhost:3000");
  });
});
