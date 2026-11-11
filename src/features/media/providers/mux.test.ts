import { beforeEach, describe, expect, it, vi } from "vitest";
import { mux } from "./mux";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  vi.stubEnv("MUX_TOKEN_ID", "id");
  vi.stubEnv("MUX_TOKEN_SECRET", "secret");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ashyan.test");
});

describe("mux provider", () => {
  it("creates a direct upload with public playback, CORS origin and an MP4 rendition", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      json({ id: "up_1", url: "https://storage.mux.com/up_1" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { providerKey, upload } = await mux.createUpload({
      key: "video/k.mp4",
      filename: "k.mp4",
      mimeType: "video/mp4",
      bytes: 10,
      kind: "VIDEO",
    });

    expect(providerKey).toBe("up_1");
    expect(upload).toEqual({ strategy: "put", url: "https://storage.mux.com/up_1" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.mux.com/video/v1/uploads");
    expect((init!.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("id:secret").toString("base64")}`,
    );
    expect(JSON.parse(init!.body as string)).toEqual({
      cors_origin: "https://ashyan.test",
      new_asset_settings: {
        playback_policies: ["public"],
        video_quality: "basic",
        static_renditions: [{ resolution: "highest" }],
      },
    });
  });

  it("honours MUX_VIDEO_QUALITY", async () => {
    vi.stubEnv("MUX_VIDEO_QUALITY", "plus");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      json({ id: "u", url: "x" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await mux.createUpload({
      key: "k",
      filename: "k",
      mimeType: "video/mp4",
      bytes: 1,
      kind: "VIDEO",
    });
    expect(
      JSON.parse(fetchMock.mock.calls[0]![1]!.body as string).new_asset_settings.video_quality,
    ).toBe("plus");
  });

  it("finalize: PROCESSING while Mux has no asset yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ status: "waiting" })),
    );
    expect(await mux.finalize("up_1", "VIDEO")).toEqual({ status: "PROCESSING" });
  });

  it("finalize: READY with playback + poster once the asset is ready", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ status: "asset_created", asset_id: "as_1" }))
        .mockResolvedValueOnce(
          json({
            id: "as_1",
            status: "ready",
            duration: 12,
            aspect_ratio: "4:3",
            playback_ids: [{ id: "pb", policy: "public" }],
          }),
        ),
    );
    const result = await mux.finalize("up_1", "VIDEO");
    expect(result).toMatchObject({
      status: "READY",
      playbackId: "pb",
      duration: 12,
      meta: { aspectRatio: 4 / 3 },
    });
  });

  it("finalize: ERRORED when the upload was cancelled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ status: "cancelled" })),
    );
    expect((await mux.finalize("up_1", "VIDEO")).status).toBe("ERRORED");
  });

  it("delete removes the asset when one exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ status: "asset_created", asset_id: "as_1" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await mux.delete("up_1");
    expect(fetchMock.mock.calls[1]![0]).toBe("https://api.mux.com/video/v1/assets/as_1");
    expect(fetchMock.mock.calls[1]![1].method).toBe("DELETE");
  });

  it("surfaces API errors with status and body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unauthorized", { status: 401, statusText: "Unauthorized" })),
    );
    await expect(mux.check!()).rejects.toThrow(/Mux \/assets\?limit=1 failed: 401/);
  });
});
