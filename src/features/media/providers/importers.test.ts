import { readFile, rm } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import type { ImportContext } from "../types";
import { localPath } from "./local";
import { local } from "./local";

const blob = vi.hoisted(() => ({
  createMultipartUpload: vi.fn(async () => ({ key: "blob-key", uploadId: "U1" })),
  uploadPart: vi.fn(async (_path: string, _body: Buffer, opts: { partNumber: number }) => ({ partNumber: opts.partNumber, etag: `e${opts.partNumber}` })),
  completeMultipartUpload: vi.fn(async () => ({})),
  del: vi.fn(),
  head: vi.fn(),
  list: vi.fn(),
}));
vi.mock("@vercel/blob", () => blob);
vi.mock("@vercel/blob/client", () => ({ generateClientTokenFromReadWriteToken: vi.fn() }));
const { vercelBlob } = await import("./vercel-blob");

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

describe("vercel-blob importer (multipart, one part per chunk)", () => {
  it("begins a public multipart upload, records parts idempotently and completes them in order", async () => {
    const { providerKey, state } = await vercelBlob.importer!.begin({ key: "video/2026/11/loop.mp4", filename: "loop.mp4", mimeType: "video/mp4", bytes: 20, kind: "VIDEO" });
    expect(providerKey).toBe("video/2026/11/loop.mp4");
    expect(blob.createMultipartUpload).toHaveBeenCalledWith("video/2026/11/loop.mp4", expect.objectContaining({ access: "public", contentType: "video/mp4", addRandomSuffix: false }));
    let s1 = state;
    for (const partNumber of [2, 1, 2]) {
      const res = await vercelBlob.importer!.part({ ...ctx({ providerKey, state: s1 }), offset: 0, partNumber, last: false }, bytes(1, 2));
      s1 = res.state!;
    }
    expect((s1.parts as { partNumber: number }[]).map((p) => p.partNumber).sort()).toEqual([1, 2]);
    await vercelBlob.importer!.complete(ctx({ providerKey, state: s1 }));
    expect(blob.completeMultipartUpload).toHaveBeenCalledWith(
      providerKey,
      [{ partNumber: 1, etag: "e1" }, { partNumber: 2, etag: "e2" }],
      expect.objectContaining({ key: "blob-key", uploadId: "U1", contentType: "video/mp4" }),
    );
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
