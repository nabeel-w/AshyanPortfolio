import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ createUploadAction: vi.fn(), completeUploadAction: vi.fn() }));
vi.mock("../actions", () => actions);

const blobPut = vi.hoisted(() => vi.fn());
vi.mock("@vercel/blob/client", () => ({ put: blobPut }));

const { uploadFile } = await import("./upload");

/** Minimal XMLHttpRequest double: records the request and lets the test resolve it. */
class FakeXHR {
  static last: FakeXHR;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown;
  status = 200;
  upload: {
    onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void;
  } = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  constructor() {
    FakeXHR.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  send(body: unknown) {
    this.body = body;
    queueMicrotask(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
      if (this.status === 0) this.onerror?.();
      else this.onload?.();
    });
  }
  abort() {
    this.onabort?.();
  }
}

const file = new File(["frame data"], "Hero Still.webp", { type: "image/webp" });

beforeEach(() => {
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
  actions.completeUploadAction.mockResolvedValue({
    id: "asset_1",
    status: "READY",
    url: "https://cdn/x.webp",
  });
});

describe("uploadFile", () => {
  it("presigned PUT: sends the raw file with its content type, reports progress, then completes", async () => {
    actions.createUploadAction.mockResolvedValue({
      assetId: "asset_1",
      upload: { strategy: "put", url: "https://bucket/put?sig=1" },
    });
    const progress: number[] = [];

    const asset = await uploadFile(file, { onProgress: (p) => progress.push(p) });

    expect(actions.createUploadAction).toHaveBeenCalledWith({
      filename: "Hero Still.webp",
      mimeType: "image/webp",
      bytes: file.size,
    });
    expect(FakeXHR.last).toMatchObject({
      method: "PUT",
      url: "https://bucket/put?sig=1",
      body: file,
    });
    expect(FakeXHR.last.headers["Content-Type"]).toBe("image/webp");
    expect(progress).toEqual([0.5, 1]);
    expect(actions.completeUploadAction).toHaveBeenCalledWith("asset_1");
    expect(asset).toMatchObject({ status: "READY" });
  });

  it("form POST: wraps the file in multipart form data under the provider's field name", async () => {
    actions.createUploadAction.mockResolvedValue({
      assetId: "a",
      upload: { strategy: "form-post", url: "https://upload.cf/x", fieldName: "file" },
    });
    await uploadFile(file);
    expect(FakeXHR.last.method).toBe("POST");
    expect((FakeXHR.last.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("Vercel Blob: uses the scoped token via the Blob client", async () => {
    actions.createUploadAction.mockResolvedValue({
      assetId: "a",
      upload: {
        strategy: "vercel-blob",
        pathname: "image/x.webp",
        token: "tok",
        contentType: "image/webp",
      },
    });
    blobPut.mockImplementation(async (_p, _f, opts) => opts.onUploadProgress({ percentage: 40 }));
    const progress: number[] = [];

    await uploadFile(file, { onProgress: (p) => progress.push(p) });

    expect(blobPut).toHaveBeenCalledWith(
      "image/x.webp",
      file,
      expect.objectContaining({
        access: "public",
        token: "tok",
        contentType: "image/webp",
        multipart: false,
      }),
    );
    expect(progress).toEqual([0.4, 1]);
  });

  it("does not finalize when the transfer fails", async () => {
    actions.createUploadAction.mockResolvedValue({
      assetId: "a",
      upload: { strategy: "put", url: "https://x" },
    });
    vi.stubGlobal(
      "XMLHttpRequest",
      class extends FakeXHR {
        override status = 403;
      },
    );
    await expect(uploadFile(file)).rejects.toThrow("Upload failed (403)");
    expect(actions.completeUploadAction).not.toHaveBeenCalled();
  });

  it("surfaces server-side validation errors before uploading", async () => {
    actions.createUploadAction.mockRejectedValue(
      new Error("Unsupported file type: application/zip"),
    );
    await expect(uploadFile(new File(["x"], "a.zip", { type: "application/zip" }))).rejects.toThrow(
      /Unsupported/,
    );
  });
});
