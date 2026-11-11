import { readFile, rm } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportContext } from "../types";
import { localPath } from "./local";
import { local } from "./local";
import { mux, nextByteFromRange } from "./mux";
import { s3, upsertPart } from "./s3";

/** Server-side chunked writes (Drive imports) for each provider's protocol. */

const ctx = (over: Partial<ImportContext> = {}): ImportContext => ({
  providerKey: "k",
  state: {},
  total: 10,
  mimeType: "video/mp4",
  filename: "master.mp4",
  ...over,
});
const bytes = (...b: number[]) => Uint8Array.from(b);

describe("mux importer (Direct Upload, Content-Range chunks)", () => {
  beforeEach(() => {
    vi.stubEnv("MUX_TOKEN_ID", "id");
    vi.stubEnv("MUX_TOKEN_SECRET", "secret");
  });

  it("parses the stored range from a 308", () => {
    expect(nextByteFromRange("bytes=0-1048575")).toBe(1048576);
    expect(nextByteFromRange(null)).toBe(0);
    expect(nextByteFromRange("garbage")).toBe(0);
  });

  it("creates a long-lived direct upload for server imports", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: { id: "up_1", url: "https://storage.googleapis.com/up_1" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await mux.importer!.begin({
      key: "k",
      filename: "m.mp4",
      mimeType: "video/mp4",
      bytes: 10,
      kind: "VIDEO",
    });
    expect(res).toEqual({
      providerKey: "up_1",
      state: { url: "https://storage.googleapis.com/up_1" },
    });
    expect(
      JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
        .timeout,
    ).toBe(86400);
  });

  it("PUTs each chunk with Content-Range and continues where Mux says it stopped", async () => {
    const fetchMock = vi.fn(
      async () => new Response(null, { status: 308, headers: { range: "bytes=0-2" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await mux.importer!.part(
      { ...ctx({ state: { url: "https://up" } }), offset: 0, partNumber: 1, last: false },
      bytes(1, 2, 3, 4),
    );
    // Sent 4 bytes, Mux kept 3: continue from byte 3
    expect(res).toEqual({ nextOffset: 3 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://up");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>)["Content-Range"]).toBe("bytes 0-3/10");
  });

  it("treats 200 on the last chunk as complete and asks for the offset when resuming", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    await expect(
      mux.importer!.part(
        { ...ctx({ state: { url: "https://up" } }), offset: 8, partNumber: 3, last: true },
        bytes(9, 10),
      ),
    ).resolves.toEqual({ nextOffset: 10 });

    const fetchMock = vi.fn(
      async () => new Response(null, { status: 308, headers: { range: "bytes=0-7" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(mux.importer!.offset!(ctx({ state: { url: "https://up" } }))).resolves.toBe(8);
    expect(
      (
        (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<
          string,
          string
        >
      )["Content-Range"],
    ).toBe("bytes */10");
  });
});

describe("s3 importer (multipart)", () => {
  beforeEach(() => {
    vi.stubEnv("S3_ENDPOINT", "https://acc.r2.cloudflarestorage.com");
    vi.stubEnv("S3_BUCKET", "media");
    vi.stubEnv("S3_ACCESS_KEY_ID", "AK");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "SK");
    vi.stubEnv("S3_PUBLIC_URL", "https://cdn.test");
  });

  it("starts a multipart upload and keeps the UploadId", async () => {
    const fetchMock = vi.fn(
      async (_req: Request) =>
        new Response(
          "<InitiateMultipartUploadResult><UploadId>U-1</UploadId></InitiateMultipartUploadResult>",
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await s3.importer!.begin({
      key: "video/a.mp4",
      filename: "a.mp4",
      mimeType: "video/mp4",
      bytes: 10,
      kind: "VIDEO",
    });
    expect(res).toEqual({ providerKey: "video/a.mp4", state: { uploadId: "U-1", parts: [] } });
    const req = fetchMock.mock.calls[0]![0];
    expect(req.method).toBe("POST");
    expect(new URL(req.url).search).toBe("?uploads");
  });

  it("uploads parts by number, records etags (retries replace), and completes in order", async () => {
    const fetchMock = vi.fn(
      async (_req: Request) => new Response("", { headers: { etag: '"e2"' } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const state = {
      uploadId: "U-1",
      parts: [
        { partNumber: 2, etag: '"old"' },
        { partNumber: 1, etag: '"e1"' },
      ],
    };
    const res = await s3.importer!.part(
      { ...ctx({ providerKey: "video/a.mp4", state }), offset: 4, partNumber: 2, last: false },
      bytes(1),
    );
    const url = new URL(fetchMock.mock.calls[0]![0].url);
    expect(url.searchParams.get("partNumber")).toBe("2");
    expect(url.searchParams.get("uploadId")).toBe("U-1");
    expect(res.state!.parts).toEqual([
      { partNumber: 1, etag: '"e1"' },
      { partNumber: 2, etag: '"e2"' },
    ]);

    fetchMock.mockImplementation(async () => new Response("<CompleteMultipartUploadResult/>"));
    await s3.importer!.complete(ctx({ providerKey: "video/a.mp4", state: res.state! }));
    const body = await fetchMock.mock.calls[1]![0].text();
    expect(body).toBe(
      "<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>&quot;e1&quot;</ETag></Part><Part><PartNumber>2</PartNumber><ETag>&quot;e2&quot;</ETag></Part></CompleteMultipartUpload>",
    );
  });

  it("surfaces a late <Error> in a 200 completion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<Error><Code>InternalError</Code></Error>")),
    );
    await expect(
      s3.importer!.complete(ctx({ state: { uploadId: "U", parts: [] } })),
    ).rejects.toThrow(/InternalError/);
  });

  it("upsertPart replaces a retried part", () => {
    expect(upsertPart([{ partNumber: 1, etag: "a" }], { partNumber: 1, etag: "b" })).toEqual([
      { partNumber: 1, etag: "b" },
    ]);
    expect(upsertPart(undefined, { partNumber: 3, etag: "c" })).toEqual([
      { partNumber: 3, etag: "c" },
    ]);
  });
});

describe("local importer (dev)", () => {
  it("writes chunks at their offsets, in any order and repeatedly", async () => {
    const key = "test-vitest/import/master.bin";
    try {
      const { providerKey } = await local.importer!.begin({
        key,
        filename: "master.bin",
        mimeType: "video/mp4",
        bytes: 6,
        kind: "VIDEO",
      });
      await local.importer!.part(
        { ...ctx({ providerKey }), offset: 3, partNumber: 2, last: true },
        bytes(4, 5, 6),
      );
      await local.importer!.part(
        { ...ctx({ providerKey }), offset: 0, partNumber: 1, last: false },
        bytes(1, 2, 3),
      );
      await local.importer!.part(
        { ...ctx({ providerKey }), offset: 0, partNumber: 1, last: false },
        bytes(1, 2, 3),
      );
      expect([...(await readFile(localPath(key)))]).toEqual([1, 2, 3, 4, 5, 6]);
    } finally {
      await rm(localPath("test-vitest/import"), { recursive: true, force: true });
    }
  });
});
