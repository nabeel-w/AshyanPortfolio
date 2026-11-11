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

const imports = vi.hoisted(() => ({
  createDriveImport: vi.fn(),
  kickImport: vi.fn(),
  importProgress: vi.fn(),
  retryImport: vi.fn(),
}));
vi.mock("./import", () => imports);

const googleAccountFor = vi.hoisted(() => vi.fn());
vi.mock("@/features/google/accounts", () => ({ googleAccountFor }));

const {
  completeUploadAction,
  createUploadAction,
  deleteAssetAction,
  importFromDriveAction,
  importProgressAction,
  retryImportAction,
} = await import("./actions");

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

describe("Google Drive import actions", () => {
  const admin = { user: { id: "u1" } };

  it("refuse to run without an admin session", async () => {
    requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(importFromDriveAction(["driveFile0001"])).rejects.toThrow("NEXT_REDIRECT");
    await expect(importProgressAction([cuid])).rejects.toThrow("NEXT_REDIRECT");
    await expect(retryImportAction(cuid)).rejects.toThrow("NEXT_REDIRECT");
    expect(imports.createDriveImport).not.toHaveBeenCalled();
    expect(imports.retryImport).not.toHaveBeenCalled();
  });

  it("validate Drive file ids before calling Google", async () => {
    requireAdmin.mockResolvedValue(admin);
    await expect(importFromDriveAction([])).rejects.toThrow();
    await expect(importFromDriveAction(["../../etc/passwd"])).rejects.toThrow();
    await expect(
      importFromDriveAction(
        Array.from({ length: 51 }, (_, i) => `driveFile${String(i).padStart(4, "0")}`),
      ),
    ).rejects.toThrow();
    expect(googleAccountFor).not.toHaveBeenCalled();
  });

  it("need a connected Drive account for this admin", async () => {
    requireAdmin.mockResolvedValue(admin);
    googleAccountFor.mockResolvedValue(null);
    await expect(importFromDriveAction(["driveFile0001"])).rejects.toThrow(/Connect Google Drive/);
    expect(googleAccountFor).toHaveBeenCalledWith("drive", "u1");
  });

  it("start one import per file, kick each, and report per-file errors", async () => {
    requireAdmin.mockResolvedValue(admin);
    googleAccountFor.mockResolvedValue({ id: "acc1" });
    imports.createDriveImport
      .mockResolvedValueOnce("asset1")
      .mockRejectedValueOnce(new Error("Unsupported file type: application/zip"));
    const results = await importFromDriveAction(["driveFile0001", "driveFile0002"]);
    expect(results).toEqual([
      { fileId: "driveFile0001", assetId: "asset1" },
      { fileId: "driveFile0002", error: "Unsupported file type: application/zip" },
    ]);
    expect(imports.createDriveImport).toHaveBeenCalledWith("acc1", "driveFile0001");
    expect(imports.kickImport).toHaveBeenCalledTimes(1);
    expect(imports.kickImport).toHaveBeenCalledWith("asset1");
    expect(invalidate.assets).toHaveBeenCalled();
  });

  it("progress refreshes the library once an import finishes", async () => {
    requireAdmin.mockResolvedValue(admin);
    imports.importProgress.mockResolvedValueOnce([{ assetId: cuid, status: "RUNNING" }]);
    await importProgressAction([cuid]);
    expect(invalidate.assets).not.toHaveBeenCalled();
    imports.importProgress.mockResolvedValueOnce([{ assetId: cuid, status: "DONE" }]);
    await importProgressAction([cuid]);
    expect(invalidate.assets).toHaveBeenCalledTimes(1);
    await expect(importProgressAction(["nope"])).rejects.toThrow();
  });
});
