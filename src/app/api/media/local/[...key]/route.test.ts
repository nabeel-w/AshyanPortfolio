import { readFile, rm } from "node:fs/promises";
import { afterAll, describe, expect, it, vi } from "vitest";
import { localPath, localSignature } from "@/features/media/providers/local";
import { PUT } from "./route";

const KEY = "test-vitest/route/upload.bin";

const put = (key: string, query: string, body: BodyInit | null = "frame-bytes") =>
  PUT(new Request(`http://localhost/api/media/local/${key}?${query}`, { method: "PUT", body }), {
    params: Promise.resolve({ key: key.split("/") }),
  });

const signed = (key: string, expires = Math.floor(Date.now() / 1000) + 60) =>
  `expires=${expires}&sig=${localSignature(key, expires)}`;

afterAll(() =>
  rm(localPath("test-vitest/x").replace(/[\\/]x$/, ""), { recursive: true, force: true }),
);

describe("PUT /api/media/local/[...key] (dev uploads)", () => {
  it("writes the body to public/uploads when the signature is valid", async () => {
    const res = await put(KEY, signed(KEY));
    expect(res.status).toBe(200);
    expect(await readFile(localPath(KEY), "utf8")).toBe("frame-bytes");
  });

  it("rejects a tampered signature", async () => {
    const expires = Math.floor(Date.now() / 1000) + 60;
    expect((await put(KEY, `expires=${expires}&sig=${"0".repeat(64)}`)).status).toBe(403);
  });

  it("rejects a signature for a different key", async () => {
    expect((await put(KEY, signed("other/key.bin"))).status).toBe(403);
  });

  it("rejects expired URLs", async () => {
    const past = Math.floor(Date.now() / 1000) - 1;
    expect((await put(KEY, signed(KEY, past))).status).toBe(403);
  });

  it("rejects path traversal even with a valid signature", async () => {
    const evil = "../../../.env.local";
    expect((await put(evil, signed(evil))).status).toBe(400);
  });

  it("is disabled in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await put(KEY, signed(KEY))).status).toBe(404);
  });
});
