import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloudflareStream } from "./cloudflare-stream";
import { mux } from "./mux";

const now = () => Math.floor(Date.now() / 1000);
const sign = (secret: string, t: number, body: string) =>
  createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");

describe("Mux webhook", () => {
  const secret = "mux-test-secret";
  beforeEach(() => vi.stubEnv("MUX_WEBHOOK_SECRET", secret));

  const readyEvent = JSON.stringify({
    type: "video.asset.ready",
    data: {
      id: "asset_1",
      upload_id: "upload_1",
      status: "ready",
      duration: 42.5,
      aspect_ratio: "16:9",
      max_stored_resolution: "HD",
      playback_ids: [{ id: "pb_1", policy: "public" }],
    },
  });
  const request = (body: string, header: string) =>
    new Request("https://site.test/api/media/webhooks/mux", {
      method: "POST",
      body,
      headers: { "mux-signature": header },
    });

  it("accepts a valid, fresh signature and maps the asset", async () => {
    const t = now();
    const update = await mux.webhook!(
      request(readyEvent, `t=${t},v1=${sign(secret, t, readyEvent)}`),
    );
    expect(update).toEqual({
      providerKey: "upload_1",
      result: expect.objectContaining({
        status: "READY",
        playbackId: "pb_1",
        duration: 42.5,
        url: "https://image.mux.com/pb_1/thumbnail.webp?time=1",
        meta: expect.objectContaining({
          hls: "https://stream.mux.com/pb_1.m3u8",
          assetId: "asset_1",
        }),
      }),
    });
  });

  it("rejects a signature made with the wrong secret", async () => {
    const t = now();
    await expect(
      mux.webhook!(request(readyEvent, `t=${t},v1=${sign("nope", t, readyEvent)}`)),
    ).rejects.toThrow(/Invalid Mux webhook signature/);
  });

  it("rejects a tampered body", async () => {
    const t = now();
    const sig = sign(secret, t, readyEvent);
    await expect(
      mux.webhook!(request(readyEvent.replace("pb_1", "pb_evil"), `t=${t},v1=${sig}`)),
    ).rejects.toThrow();
  });

  it("rejects replays older than 5 minutes", async () => {
    const t = now() - 600;
    await expect(
      mux.webhook!(request(readyEvent, `t=${t},v1=${sign(secret, t, readyEvent)}`)),
    ).rejects.toThrow();
  });

  it("ignores unrelated events", async () => {
    const body = JSON.stringify({ type: "video.upload.created", data: { id: "x" } });
    const t = now();
    expect(await mux.webhook!(request(body, `t=${t},v1=${sign(secret, t, body)}`))).toBeNull();
  });

  it("maps errored assets", async () => {
    const body = JSON.stringify({
      type: "video.asset.errored",
      data: { id: "a", upload_id: "u", status: "errored", errors: { messages: ["bad codec"] } },
    });
    const t = now();
    const update = await mux.webhook!(request(body, `t=${t},v1=${sign(secret, t, body)}`));
    expect(update?.result).toEqual({
      status: "ERRORED",
      meta: { assetId: "a", error: "bad codec" },
    });
  });

  it("refuses to run without a secret configured", async () => {
    vi.stubEnv("MUX_WEBHOOK_SECRET", "");
    await expect(mux.webhook!(request(readyEvent, "t=1,v1=00"))).rejects.toThrow(/not set/);
  });
});

describe("Cloudflare Stream webhook", () => {
  const secret = "cf-test-secret";
  beforeEach(() => {
    vi.stubEnv("CLOUDFLARE_STREAM_WEBHOOK_SECRET", secret);
    vi.stubEnv("CLOUDFLARE_STREAM_CUSTOMER_CODE", "abc123");
  });

  const video = JSON.stringify({
    uid: "vid_1",
    readyToStream: true,
    status: { state: "ready" },
    duration: 30,
    input: { width: 1920, height: 1080 },
  });
  const request = (body: string, header: string) =>
    new Request("https://site.test/api/media/webhooks/cloudflare-stream", {
      method: "POST",
      body,
      headers: { "webhook-signature": header },
    });

  it("accepts a valid signature and builds customer-domain URLs", async () => {
    const t = now();
    const update = await cloudflareStream.webhook!(
      request(video, `time=${t},sig1=${sign(secret, t, video)}`),
    );
    expect(update?.providerKey).toBe("vid_1");
    expect(update?.result).toMatchObject({
      status: "READY",
      width: 1920,
      height: 1080,
      url: "https://customer-abc123.cloudflarestream.com/vid_1/thumbnails/thumbnail.jpg?time=1s",
      meta: { hls: "https://customer-abc123.cloudflarestream.com/vid_1/manifest/video.m3u8" },
    });
  });

  it("reports processing videos as PROCESSING", async () => {
    const body = JSON.stringify({
      uid: "v",
      readyToStream: false,
      status: { state: "inprogress" },
    });
    const t = now();
    const update = await cloudflareStream.webhook!(
      request(body, `time=${t},sig1=${sign(secret, t, body)}`),
    );
    expect(update?.result.status).toBe("PROCESSING");
  });

  it("rejects bad signatures", async () => {
    await expect(
      cloudflareStream.webhook!(request(video, `time=${now()},sig1=00ff`)),
    ).rejects.toThrow(/Invalid Cloudflare Stream webhook signature/);
  });
});
