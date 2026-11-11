import { describe, expect, it, vi } from "vitest";

const requireAdmin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/session", () => ({ requireAdmin }));

const service = vi.hoisted(() => ({
  createUpload: vi.fn(),
  completeUpload: vi.fn(),
  deleteAsset: vi.fn(),
}));
vi.mock("./service", () => service);

const invalidate = vi.hoisted(() => ({ assets: vi.fn(), projects: vi.fn(), clients: vi.fn() }));
vi.mock("@/features/content/invalidate", () => ({ invalidate }));

const { completeUploadAction, createUploadAction, deleteAssetAction } = await import("./actions");

const cuid = "cmwbj2o1m0001rovldp9zmq0k";

describe("media server actions", () => {
  it("refuse to run without an admin session", async () => {
    requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      createUploadAction({ filename: "a.png", mimeType: "image/png", bytes: 1 }),
    ).rejects.toThrow("NEXT_REDIRECT");
    await expect(completeUploadAction(cuid)).rejects.toThrow();
    await expect(deleteAssetAction(cuid)).rejects.toThrow();
    expect(service.createUpload).not.toHaveBeenCalled();
    expect(service.completeUpload).not.toHaveBeenCalled();
    expect(service.deleteAsset).not.toHaveBeenCalled();
  });

  it("validate input before calling the service", async () => {
    requireAdmin.mockResolvedValue({});
    await expect(
      createUploadAction({ filename: "", mimeType: "image/png", bytes: 1 }),
    ).rejects.toThrow();
    await expect(
      createUploadAction({ filename: "a.png", mimeType: "image/png", bytes: -5 }),
    ).rejects.toThrow();
    await expect(deleteAssetAction("../../etc")).rejects.toThrow();
    expect(service.createUpload).not.toHaveBeenCalled();
    expect(service.deleteAsset).not.toHaveBeenCalled();
  });

  it("invalidate the asset cache only when an upload becomes READY", async () => {
    requireAdmin.mockResolvedValue({});
    service.completeUpload.mockResolvedValueOnce({ id: cuid, status: "PROCESSING" });
    await completeUploadAction(cuid);
    expect(invalidate.assets).not.toHaveBeenCalled();

    service.completeUpload.mockResolvedValueOnce({
      id: cuid,
      status: "READY",
      url: "https://cdn/x",
    });
    const result = await completeUploadAction(cuid);
    expect(invalidate.assets).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ id: cuid, status: "READY", url: "https://cdn/x" });
  });

  it("deleting an asset refreshes everything that can show it", async () => {
    requireAdmin.mockResolvedValue({});
    await deleteAssetAction(cuid);
    expect(service.deleteAsset).toHaveBeenCalledWith(cuid);
    expect(invalidate.assets).toHaveBeenCalled();
    expect(invalidate.projects).toHaveBeenCalled();
    expect(invalidate.clients).toHaveBeenCalled();
  });
});
