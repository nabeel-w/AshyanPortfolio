import { beforeEach, describe, expect, it, vi } from "vitest";
import { s3 } from "./s3";

const input = {
  key: "image/2026/11/hero-ab12.webp",
  filename: "hero.webp",
  mimeType: "image/webp",
  bytes: 1000,
  kind: "IMAGE" as const,
};

beforeEach(() => {
  vi.stubEnv("S3_ENDPOINT", "https://acc123.r2.cloudflarestorage.com/");
  vi.stubEnv("S3_BUCKET", "ashyan-media");
  vi.stubEnv("S3_ACCESS_KEY_ID", "AKIDTEST");
  vi.stubEnv("S3_SECRET_ACCESS_KEY", "secret");
  vi.stubEnv("S3_PUBLIC_URL", "https://media.example.com/");
  vi.stubEnv("S3_REGION", "auto");
});

describe("s3 provider · createUpload", () => {
  it("returns a SigV4 presigned PUT (path-style) valid for 15 minutes", async () => {
    const { providerKey, upload } = await s3.createUpload(input);
    expect(providerKey).toBe(input.key);
    expect(upload.strategy).toBe("put");
    const url = new URL((upload as { url: string }).url);
    expect(url.origin + url.pathname).toBe(
      "https://acc123.r2.cloudflarestorage.com/ashyan-media/image/2026/11/hero-ab12.webp",
    );
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-Credential")).toMatch(
      /^AKIDTEST\/\d{8}\/auto\/s3\/aws4_request$/,
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("supports virtual-hosted buckets (AWS)", async () => {
    vi.stubEnv("S3_ENDPOINT", "https://s3.ap-south-1.amazonaws.com");
    vi.stubEnv("S3_FORCE_PATH_STYLE", "false");
    const { upload } = await s3.createUpload(input);
    expect(new URL((upload as { url: string }).url).host).toBe(
      "ashyan-media.s3.ap-south-1.amazonaws.com",
    );
  });
});

describe("s3 provider · finalize / delete", () => {
  it("HEADs the object and returns the public CDN URL", async () => {
    const fetchMock = vi.fn(
      async (_req: Request) =>
        new Response(null, { status: 200, headers: { "content-length": "1234" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await s3.finalize(input.key, "IMAGE");
    expect(result).toEqual({
      status: "READY",
      url: "https://media.example.com/image/2026/11/hero-ab12.webp",
      bytes: 1234,
      meta: { mp4: "https://media.example.com/image/2026/11/hero-ab12.webp" },
    });
    const req = fetchMock.mock.calls[0]![0];
    expect(req.method).toBe("HEAD");
    expect(req.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256/);
  });

  it("marks missing objects as ERRORED", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    expect((await s3.finalize(input.key, "IMAGE")).status).toBe("ERRORED");
  });

  it("treats deleting an already-missing object as success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    await expect(s3.delete(input.key)).resolves.toBeUndefined();
  });

  it("surfaces other delete failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("denied", { status: 403, statusText: "Forbidden" })),
    );
    await expect(s3.delete(input.key)).rejects.toThrow(/S3 delete failed: 403/);
  });
});
