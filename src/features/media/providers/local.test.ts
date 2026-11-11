import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LOCAL_ROOT, local, localPath, localSignature } from "./local";

describe("local provider", () => {
  it("keeps every key inside public/uploads", () => {
    expect(localPath("image/2026/11/a.webp")).toBe(
      path.join(LOCAL_ROOT, "image", "2026", "11", "a.webp"),
    );
    expect(() => localPath("../../.env.local")).toThrow(/Invalid key/);
    expect(() => localPath("..")).toThrow(/Invalid key/);
  });

  it("signs upload URLs with an expiry, like a presigned URL", async () => {
    const { providerKey, upload } = await local.createUpload({
      key: "image/a.webp",
      filename: "a.webp",
      mimeType: "image/webp",
      bytes: 1,
      kind: "IMAGE",
    });
    expect(providerKey).toBe("image/a.webp");
    expect(upload.strategy).toBe("put");
    const url = new URL((upload as { url: string }).url, "http://localhost");
    const expires = Number(url.searchParams.get("expires"));
    expect(url.pathname).toBe("/api/media/local/image/a.webp");
    expect(expires).toBeGreaterThan(Date.now() / 1000);
    expect(url.searchParams.get("sig")).toBe(localSignature("image/a.webp", expires));
  });

  it("signatures depend on key, expiry and secret", () => {
    const a = localSignature("k", 100);
    expect(localSignature("k", 101)).not.toBe(a);
    expect(localSignature("k2", 100)).not.toBe(a);
    vi.stubEnv("BETTER_AUTH_SECRET", "a-different-secret-a-different-secret!!");
    expect(localSignature("k", 100)).not.toBe(a);
  });

  it("is disabled in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      local.createUpload({
        key: "k",
        filename: "k",
        mimeType: "image/png",
        bytes: 1,
        kind: "IMAGE",
      }),
    ).rejects.toThrow(/development only/);
  });
});
