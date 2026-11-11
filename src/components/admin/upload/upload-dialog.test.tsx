import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleStatus } from "@/features/google/scopes";

const media = vi.hoisted(() => ({
  completeUploadAction: vi.fn(),
  importFromDriveAction: vi.fn(),
  importProgressAction: vi.fn(),
  retryImportAction: vi.fn(),
}));
vi.mock("@/features/media/actions", () => media);

const uploadFile = vi.hoisted(() => vi.fn());
vi.mock("@/features/media/client/upload", () => ({ uploadFile }));

const google = vi.hoisted(() => ({
  googleStatusAction: vi.fn(),
  drivePickerAction: vi.fn(),
  disconnectGoogleAction: vi.fn(),
}));
vi.mock("@/features/google/actions", () => google);

const googleClient = vi.hoisted(() => ({ connectGoogle: vi.fn(), pickDriveFiles: vi.fn() }));
vi.mock("@/features/google/client", () => googleClient);

const { UploadDialog } = await import("./upload-dialog");
const { useUploadQueue } = await import("./use-upload-queue");

function Harness({ accept }: { accept?: string }) {
  const queue = useUploadQueue();
  return <UploadDialog open onOpenChange={() => {}} queue={queue} accept={accept} />;
}

const status = (over: Partial<GoogleStatus> = {}): GoogleStatus => ({
  configured: true,
  pickerConfigured: true,
  accounts: [],
  ...over,
});
const file = (name: string, type: string) => new File(["x"], name, { type });

beforeEach(() => {
  google.googleStatusAction.mockResolvedValue(status());
});

describe("<UploadDialog> · This device", () => {
  it("uploads picked files and shows each in the queue with progress", async () => {
    const user = userEvent.setup();
    let progress: (f: number) => void = () => {};
    let finish: (v: unknown) => void = () => {};
    uploadFile.mockImplementation((_f: File, opts: { onProgress: (f: number) => void }) => {
      progress = opts.onProgress;
      return new Promise((r) => (finish = r));
    });
    render(<Harness />);

    expect(screen.getByRole("tab", { name: /this device/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const input = screen.getByTestId("device-input");
    expect(input).toHaveAttribute("accept", "image/*,video/*,application/pdf");
    await user.upload(input, file("hero.webp", "image/webp"));

    const item = await screen.findByTestId("queue-item");
    expect(within(item).getByText("hero.webp")).toBeInTheDocument();
    act(() => progress(0.42));
    expect(within(item).getByText("42%")).toBeInTheDocument();
    expect(within(item).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");

    await act(async () => finish({ id: "a1", status: "READY" }));
    expect(within(item).getByText("Done")).toBeInTheDocument();
  });

  it("shows failures and retries the same file", async () => {
    const user = userEvent.setup();
    uploadFile
      .mockRejectedValueOnce(new Error("Upload failed (network)"))
      .mockResolvedValueOnce({ id: "a1", status: "READY" });
    render(<Harness />);
    await user.upload(screen.getByTestId("device-input"), file("cut.mp4", "video/mp4"));
    expect(await screen.findByText("Upload failed (network)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry cut.mp4" }));
    expect(await screen.findByText("Done")).toBeInTheDocument();
    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(uploadFile.mock.calls[1]![0].name).toBe("cut.mp4");
  });
});

describe("<UploadDialog> · Google Drive", () => {
  it("says when Google isn't configured", async () => {
    google.googleStatusAction.mockResolvedValue(
      status({ configured: false, pickerConfigured: false }),
    );
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: /google drive/i }));
    expect(await screen.findByText(/isn.t set up yet/i)).toBeInTheDocument();
  });

  it("connects Drive with the drive scope when not connected", async () => {
    google.googleStatusAction.mockResolvedValueOnce(status()).mockResolvedValue(
      status({
        accounts: [{ id: "acc1", email: "ashyan@gmail.com", drive: true, gmail: false }],
      }),
    );
    googleClient.connectGoogle.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: /google drive/i }));
    await user.click(await screen.findByRole("button", { name: "Connect Google Drive" }));
    expect(googleClient.connectGoogle).toHaveBeenCalledWith("drive");
    expect(await screen.findByText("ashyan@gmail.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose from Drive" })).toBeInTheDocument();
  });

  it("imports picked files and follows server-side progress until ready", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    google.googleStatusAction.mockResolvedValue(
      status({ accounts: [{ id: "acc1", email: "a@gmail.com", drive: true, gmail: false }] }),
    );
    google.drivePickerAction.mockResolvedValue({ accessToken: "t", apiKey: "k", appId: "123" });
    googleClient.pickDriveFiles.mockResolvedValue([
      { id: "driveFile0001", name: "Master.mov", mimeType: "video/quicktime" },
    ]);
    media.importFromDriveAction.mockResolvedValue([{ fileId: "driveFile0001", assetId: "asset1" }]);
    media.importProgressAction
      .mockResolvedValueOnce([
        { assetId: "asset1", status: "RUNNING", bytesDone: 25, bytesTotal: 100, error: null },
      ])
      .mockResolvedValueOnce([
        { assetId: "asset1", status: "DONE", bytesDone: 100, bytesTotal: 100, error: null },
      ]);
    media.completeUploadAction.mockResolvedValue({ id: "asset1", status: "READY" });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness accept="video/*" />);
    await user.click(screen.getByRole("tab", { name: /google drive/i }));
    await user.click(await screen.findByRole("button", { name: "Choose from Drive" }));

    // The Picker gets the exact accepted video types (it has no wildcards)
    expect(googleClient.pickDriveFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "t",
        mimeTypes: expect.arrayContaining(["video/mp4", "video/quicktime"]),
      }),
    );
    expect(googleClient.pickDriveFiles.mock.calls[0]![0].mimeTypes).not.toContain("image/png");
    expect(media.importFromDriveAction).toHaveBeenCalledWith(["driveFile0001"]);

    const item = await screen.findByTestId("queue-item");
    expect(within(item).getByRole("img", { name: "Google Drive" })).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(2600));
    expect(within(item).getByText("25%")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(2600));
    expect(within(item).getByText("Processing…")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(2600));
    expect(within(item).getByText("Done")).toBeInTheDocument();
    expect(media.completeUploadAction).toHaveBeenCalledWith("asset1");
    vi.useRealTimers();
  });

  it("shows a failed import with retry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    google.googleStatusAction.mockResolvedValue(
      status({ accounts: [{ id: "acc1", email: "a@gmail.com", drive: true, gmail: false }] }),
    );
    google.drivePickerAction.mockResolvedValue({ accessToken: "t", apiKey: "k", appId: "123" });
    googleClient.pickDriveFiles.mockResolvedValue([
      { id: "driveFile0001", name: "Master.mov", mimeType: "video/quicktime" },
    ]);
    media.importFromDriveAction.mockResolvedValue([{ fileId: "driveFile0001", assetId: "asset1" }]);
    media.importProgressAction.mockResolvedValue([
      {
        assetId: "asset1",
        status: "FAILED",
        bytesDone: 0,
        bytesTotal: 100,
        error: "Google Drive's download quota for this file is used up.",
      },
    ]);
    media.retryImportAction.mockResolvedValue(undefined);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: /google drive/i }));
    await user.click(await screen.findByRole("button", { name: "Choose from Drive" }));
    await screen.findByTestId("queue-item");
    await act(() => vi.advanceTimersByTimeAsync(2600));
    expect(screen.getByText(/download quota/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry Master.mov" }));
    expect(media.retryImportAction).toHaveBeenCalledWith("asset1");
    vi.useRealTimers();
  });
});
