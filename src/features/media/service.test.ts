import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  asset: {
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ db }));

const fake = vi.hoisted(() => {
  const provider = {
    id: "fake",
    label: "Fake",
    kinds: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"],
    requiredEnv: [],
    setup: "none",
    createUpload: vi.fn(),
    finalize: vi.fn(),
    delete: vi.fn(),
    read: vi.fn(),
    webhook: vi.fn(),
  };
  return { provider };
});
vi.mock("./providers", () => ({
  providerFor: vi.fn(() => fake.provider),
  getProvider: vi.fn((id: string) => {
    if (id !== "fake") throw new Error(`Unknown media provider "${id}"`);
    return fake.provider;
  }),
}));

const analyzeImage = vi.hoisted(() => vi.fn());
vi.mock("./image-meta", () => ({ analyzeImage }));

const { applyWebhook, completeUpload, createUpload, deleteAsset } = await import("./service");
const provider = fake.provider;

beforeEach(() => {
  db.asset.update.mockImplementation(async ({ data }: { data: object }) => ({
    id: "asset_1",
    ...data,
  }));
});

describe("createUpload", () => {
  it("rejects unsupported file types before touching the provider", async () => {
    await expect(
      createUpload({ filename: "x.exe", mimeType: "application/x-msdownload", bytes: 10 }),
    ).rejects.toThrow(/Unsupported file type/);
    expect(provider.createUpload).not.toHaveBeenCalled();
  });

  it("enforces per-kind size limits", async () => {
    vi.stubEnv("MEDIA_MAX_IMAGE_MB", "1");
    await expect(
      createUpload({ filename: "big.png", mimeType: "image/png", bytes: 2 * 1024 * 1024 }),
    ).rejects.toThrow(/under 1 MB/);
    await expect(
      createUpload({ filename: "empty.png", mimeType: "image/png", bytes: 0 }),
    ).rejects.toThrow();
  });

  it("asks the provider for an upload instruction and records an UPLOADING asset", async () => {
    provider.createUpload.mockResolvedValue({
      providerKey: "pk_1",
      upload: { strategy: "put", url: "https://up" },
    });
    db.asset.create.mockResolvedValue({ id: "asset_1" });

    const ticket = await createUpload({
      filename: "Hero Still.png",
      mimeType: "image/png",
      bytes: 1234,
    });

    expect(provider.createUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "IMAGE",
        mimeType: "image/png",
        bytes: 1234,
        key: expect.stringMatching(/^image\/\d{4}\/\d{2}\/hero-still-/),
      }),
    );
    expect(db.asset.create).toHaveBeenCalledWith({
      data: {
        kind: "IMAGE",
        provider: "fake",
        providerKey: "pk_1",
        status: "UPLOADING",
        filename: "Hero Still.png",
        mimeType: "image/png",
        bytes: 1234,
      },
    });
    expect(ticket).toEqual({
      assetId: "asset_1",
      kind: "IMAGE",
      provider: "fake",
      upload: { strategy: "put", url: "https://up" },
    });
  });
});

describe("completeUpload", () => {
  it("adds dimensions, blur and colour to READY images", async () => {
    db.asset.findUniqueOrThrow.mockResolvedValue({
      id: "asset_1",
      kind: "IMAGE",
      provider: "fake",
      providerKey: "pk",
    });
    provider.finalize.mockResolvedValue({ status: "READY", url: "https://cdn/x.png", bytes: 99 });
    provider.read.mockResolvedValue(Buffer.from("img"));
    analyzeImage.mockResolvedValue({
      width: 10,
      height: 5,
      blurDataUrl: "data:image/webp;base64,AA",
      dominantColor: "#c1121f",
    });

    const asset = await completeUpload("asset_1");

    expect(provider.read).toHaveBeenCalledWith("pk");
    expect(asset).toMatchObject({
      status: "READY",
      url: "https://cdn/x.png",
      width: 10,
      height: 5,
      dominantColor: "#c1121f",
    });
  });

  it("keeps the image usable when analysis fails", async () => {
    db.asset.findUniqueOrThrow.mockResolvedValue({
      id: "asset_1",
      kind: "IMAGE",
      provider: "fake",
      providerKey: "pk",
    });
    provider.finalize.mockResolvedValue({ status: "READY", url: "https://cdn/x.png" });
    provider.read.mockRejectedValue(new Error("network"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const asset = await completeUpload("asset_1");
    expect(asset).toMatchObject({ status: "READY", url: "https://cdn/x.png" });
    expect(asset).not.toHaveProperty("blurDataUrl");
  });

  it("does not analyse videos (they may still be transcoding)", async () => {
    db.asset.findUniqueOrThrow.mockResolvedValue({
      id: "asset_1",
      kind: "VIDEO",
      provider: "fake",
      providerKey: "pk",
    });
    provider.finalize.mockResolvedValue({ status: "PROCESSING" });
    const asset = await completeUpload("asset_1");
    expect(analyzeImage).not.toHaveBeenCalled();
    expect(asset.status).toBe("PROCESSING");
  });
});

describe("applyWebhook", () => {
  const req = new Request("https://x", { method: "POST", body: "{}" });

  it("updates the matching asset by (provider, providerKey)", async () => {
    provider.webhook.mockResolvedValue({
      providerKey: "pk",
      result: { status: "READY", playbackId: "pb" },
    });
    db.asset.findUnique.mockResolvedValue({ id: "asset_1" });

    const asset = await applyWebhook("fake", req);
    expect(db.asset.findUnique).toHaveBeenCalledWith({
      where: { provider_providerKey: { provider: "fake", providerKey: "pk" } },
    });
    expect(asset).toMatchObject({ status: "READY", playbackId: "pb" });
  });

  it("ignores events for assets this app didn't create", async () => {
    provider.webhook.mockResolvedValue({ providerKey: "unknown", result: { status: "READY" } });
    db.asset.findUnique.mockResolvedValue(null);
    expect(await applyWebhook("fake", req)).toBeNull();
    expect(db.asset.update).not.toHaveBeenCalled();
  });

  it("propagates signature failures", async () => {
    provider.webhook.mockRejectedValue(new Error("Invalid signature"));
    await expect(applyWebhook("fake", req)).rejects.toThrow(/Invalid signature/);
  });
});

describe("deleteAsset", () => {
  it("deletes at the provider before removing the row", async () => {
    const order: string[] = [];
    db.asset.findUniqueOrThrow.mockResolvedValue({
      id: "asset_1",
      provider: "fake",
      providerKey: "pk",
    });
    provider.delete.mockImplementation(async () => void order.push("provider"));
    db.asset.delete.mockImplementation(async () => void order.push("db"));

    await deleteAsset("asset_1");
    expect(order).toEqual(["provider", "db"]);
  });

  it("keeps the row if the provider delete fails", async () => {
    db.asset.findUniqueOrThrow.mockResolvedValue({
      id: "asset_1",
      provider: "fake",
      providerKey: "pk",
    });
    provider.delete.mockRejectedValue(new Error("403"));
    await expect(deleteAsset("asset_1")).rejects.toThrow("403");
    expect(db.asset.delete).not.toHaveBeenCalled();
  });
});
