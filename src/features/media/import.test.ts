import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The resumable import engine, against an in-memory DB, a fake Drive source and a fake provider.
 * Chunks are shrunk to 4 bytes so a "multi-chunk master" is a 10-byte buffer.
 */

vi.mock("./types", async (orig) => ({
  ...(await orig<typeof import("./types")>()),
  IMPORT_CHUNK_BYTES: 4,
}));

type Job = {
  assetId: string;
  source: string;
  sourceId: string;
  accountId: string;
  bytesTotal: bigint;
  bytesDone: bigint;
  state: Record<string, unknown>;
  status: "RUNNING" | "DONE" | "FAILED";
  error: string | null;
  attempts: number;
  leaseUntil: Date | null;
  updatedAt: Date;
};
type AssetRow = {
  id: string;
  provider: string;
  providerKey: string;
  mimeType: string;
  filename: string;
  status: string;
  kind: string;
};

const store = vi.hoisted(() => ({
  jobs: new Map<string, Job>(),
  assets: new Map<string, AssetRow>(),
}));

const db = vi.hoisted(() => {
  const leaseFree = (j: Job, now: Date) => !j.leaseUntil || j.leaseUntil < now;
  return {
    assetImport: {
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { assetId: string; OR: [{ leaseUntil: null }, { leaseUntil: { lt: Date } }] };
          data: Partial<Job>;
        }) => {
          const j = store.jobs.get(where.assetId);
          const now = where.OR[1].leaseUntil.lt;
          if (!j || j.status !== "RUNNING" || !leaseFree(j, now)) return { count: 0 };
          Object.assign(j, data, { updatedAt: new Date() });
          return { count: 1 };
        },
      ),
      findUnique: vi.fn(
        async ({
          where,
          include,
        }: {
          where: { assetId: string };
          include?: { asset?: boolean };
        }) => {
          const j = store.jobs.get(where.assetId);
          if (!j) return null;
          return include?.asset ? { ...j, asset: store.assets.get(j.assetId) } : { ...j };
        },
      ),
      update: vi.fn(async ({ where, data }: { where: { assetId: string }; data: Partial<Job> }) => {
        const j = store.jobs.get(where.assetId);
        if (!j) throw new Error("Record to update not found");
        Object.assign(j, data, { updatedAt: new Date() });
        return { ...j };
      }),
      findMany: vi.fn(async ({ where }: { where: { assetId: { in: string[] } } }) =>
        where.assetId.in
          .map((id) => store.jobs.get(id))
          .filter(Boolean)
          .map((j) => ({ ...j! })),
      ),
    },
    asset: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<AssetRow> }) => {
        Object.assign(store.assets.get(where.id)!, data);
      }),
      create: vi.fn(async ({ data }: { data: AssetRow & { import: { create: Partial<Job> } } }) => {
        const id = `asset${store.assets.size + 1}`;
        const { import: imp, ...asset } = data;
        store.assets.set(id, { ...asset, id });
        store.jobs.set(id, {
          bytesDone: BigInt(0),
          status: "RUNNING",
          error: null,
          attempts: 0,
          leaseUntil: null,
          ...imp.create,
          updatedAt: new Date(),
          assetId: id,
        } as Job);
        return { id };
      }),
    },
  };
});
vi.mock("@/lib/db", () => ({ db }));

const drive = vi.hoisted(() => ({ driveFileMeta: vi.fn(), driveReadRange: vi.fn() }));
vi.mock("@/features/google/drive", () => drive);

const importer = vi.hoisted(() => ({
  begin: vi.fn(),
  part: vi.fn(),
  complete: vi.fn(),
  offset: undefined as undefined | ReturnType<typeof vi.fn>,
}));
const provider = vi.hoisted(() => ({ id: "fake", label: "Fake", importer: importer as unknown }));
vi.mock("./providers", () => ({ getProvider: () => provider, providerFor: () => provider }));

const completeUpload = vi.hoisted(() => vi.fn());
vi.mock("./service", async (orig) => ({
  ...(await orig<typeof import("./service")>()),
  completeUpload,
}));

const { runImport, createDriveImport, verifyKick, signKick, importProgress, retryImport } =
  await import("./import");
const { PermanentImportError } = await import("./types");

const FILE = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
const read = (_a: string, _f: string, start: number, end: number) =>
  Promise.resolve(FILE.slice(start, end + 1));

function seed(over: Partial<Job> = {}) {
  store.assets.set("a1", {
    id: "a1",
    provider: "fake",
    providerKey: "k1",
    mimeType: "video/mp4",
    filename: "master.mp4",
    status: "UPLOADING",
    kind: "VIDEO",
  });
  store.jobs.set("a1", {
    assetId: "a1",
    source: "google-drive",
    sourceId: "driveFile123",
    accountId: "acc1",
    bytesTotal: BigInt(10),
    bytesDone: BigInt(0),
    state: {},
    status: "RUNNING",
    error: null,
    attempts: 0,
    leaseUntil: null,
    updatedAt: new Date(),
    ...over,
  });
}

/** The bytes the provider received, reassembled by offset. */
function received() {
  const out = new Uint8Array(10);
  for (const [part, bytes] of importer.part.mock.calls as [{ offset: number }, Uint8Array][])
    out.set(bytes, part.offset);
  return out;
}

beforeEach(() => {
  store.jobs.clear();
  store.assets.clear();
  importer.offset = undefined;
  importer.part.mockImplementation(
    async ({ partNumber, state }: { partNumber: number; state: { parts?: number[] } }) => ({
      state: { parts: [...(state.parts ?? []), partNumber] },
    }),
  );
  importer.complete.mockResolvedValue(undefined);
  drive.driveReadRange.mockImplementation(read);
});

describe("runImport", () => {
  it("moves a file chunk by chunk, saving progress, then completes and finalizes", async () => {
    seed();
    await expect(runImport("a1", { retryDelayMs: 0 })).resolves.toEqual({ status: "done" });

    expect(importer.part.mock.calls.map(([p]) => [p.offset, p.partNumber, p.last])).toEqual([
      [0, 1, false],
      [4, 2, false],
      [8, 3, true],
    ]);
    expect(received()).toEqual(FILE);
    // Provider state from each part is carried into the next and into complete()
    expect(importer.complete).toHaveBeenCalledWith(
      expect.objectContaining({ state: { parts: [1, 2, 3] }, total: 10 }),
    );
    expect(completeUpload).toHaveBeenCalledWith("a1");
    expect(store.jobs.get("a1")).toMatchObject({
      status: "DONE",
      bytesDone: BigInt(10),
      leaseUntil: null,
    });
  });

  it("resumes from the last saved chunk after a failed run instead of starting over", async () => {
    seed();
    let calls = 0;
    drive.driveReadRange.mockImplementation(
      async (a: string, f: string, start: number, end: number) => {
        if (start === 4 && calls++ < 3) throw new Error("Drive download failed: 503");
        return read(a, f, start, end);
      },
    );

    const first = await runImport("a1", { retryDelayMs: 0 });
    expect(first).toMatchObject({ status: "retry", attempts: 1 });
    // Chunk 1 is safe; chunk 2 was retried in place 3 times before the run gave up
    expect(store.jobs.get("a1")).toMatchObject({
      status: "RUNNING",
      bytesDone: BigInt(4),
      attempts: 1,
      leaseUntil: null,
    });
    expect(store.jobs.get("a1")!.error).toMatch(/503/);
    expect(importer.part).toHaveBeenCalledTimes(1);

    importer.part.mockClear();
    await expect(runImport("a1", { retryDelayMs: 0 })).resolves.toEqual({ status: "done" });
    expect(importer.part.mock.calls.map(([p]) => p.offset)).toEqual([4, 8]);
    expect(store.jobs.get("a1")).toMatchObject({ status: "DONE", attempts: 0, error: null });
  });

  it("asks the provider where to continue when it can tell (resumable sessions)", async () => {
    seed({ bytesDone: BigInt(4) });
    // e.g. a crash after the provider stored chunk 2 but before we saved it
    importer.offset = vi.fn(async () => 8);
    provider.importer = importer;
    await runImport("a1", { retryDelayMs: 0 });
    expect(importer.part.mock.calls.map(([p]) => p.offset)).toEqual([8]);
  });

  it("continues from the provider's nextOffset when it kept fewer bytes than sent", async () => {
    seed();
    importer.part.mockImplementationOnce(async () => ({ nextOffset: 2 }));
    await runImport("a1", { retryDelayMs: 0 });
    expect(importer.part.mock.calls.map(([p]) => p.offset)).toEqual([0, 2, 6]);
    expect(received()).toEqual(FILE);
  });

  it("fails at once on a permanent error and marks the asset ERRORED", async () => {
    seed();
    drive.driveReadRange.mockRejectedValue(
      new PermanentImportError("Google Drive's download quota for this file is used up."),
    );
    await expect(runImport("a1", { retryDelayMs: 0 })).resolves.toMatchObject({ status: "failed" });
    expect(drive.driveReadRange).toHaveBeenCalledTimes(1);
    expect(store.jobs.get("a1")).toMatchObject({
      status: "FAILED",
      error: expect.stringMatching(/quota/),
    });
    expect(store.assets.get("a1")!.status).toBe("ERRORED");
  });

  it("gives up after 5 failed runs", async () => {
    seed({ attempts: 4 });
    drive.driveReadRange.mockRejectedValue(new Error("network"));
    await expect(runImport("a1", { retryDelayMs: 0 })).resolves.toMatchObject({ status: "failed" });
    expect(store.jobs.get("a1")!.status).toBe("FAILED");
  });

  it("lets only one runner work at a time (lease)", async () => {
    seed({ leaseUntil: new Date(Date.now() + 60_000) });
    await expect(runImport("a1")).resolves.toEqual({ status: "busy" });
    expect(importer.part).not.toHaveBeenCalled();
  });

  it("stops at the time budget and releases the lease for the next invocation", async () => {
    seed();
    await expect(runImport("a1", { budgetMs: -1 })).resolves.toEqual({
      status: "paused",
      bytesDone: 0,
    });
    expect(store.jobs.get("a1")!.leaseUntil).toBeNull();
  });
});

describe("createDriveImport", () => {
  beforeEach(() => {
    importer.begin.mockResolvedValue({ providerKey: "upload-1", state: { url: "https://up" } });
  });

  it("validates type and size with the device-upload rules before touching the provider", async () => {
    drive.driveFileMeta.mockResolvedValueOnce({
      id: "f1234567890",
      name: "notes.zip",
      mimeType: "application/zip",
      size: 10,
    });
    await expect(createDriveImport("acc1", "f1234567890")).rejects.toThrow(/Unsupported file type/);

    drive.driveFileMeta.mockResolvedValueOnce({
      id: "f1234567890",
      name: "huge.png",
      mimeType: "image/png",
      size: 51 * 1024 * 1024,
    });
    await expect(createDriveImport("acc1", "f1234567890")).rejects.toThrow(/under 50 MB/);
    expect(importer.begin).not.toHaveBeenCalled();
  });

  it("creates an UPLOADING asset with its import job (BigInt sizes for > 2 GiB masters)", async () => {
    const size = 3 * 1024 ** 3;
    drive.driveFileMeta.mockResolvedValueOnce({
      id: "f1234567890",
      name: "Master Cut.mov",
      mimeType: "video/quicktime",
      size,
    });
    const id = await createDriveImport("acc1", "f1234567890");
    expect(importer.begin).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "Master Cut.mov", bytes: size, kind: "VIDEO" }),
    );
    expect(store.assets.get(id)).toMatchObject({ providerKey: "upload-1", status: "UPLOADING" });
    expect(store.jobs.get(id)).toMatchObject({
      sourceId: "f1234567890",
      accountId: "acc1",
      bytesTotal: BigInt(size),
      state: { url: "https://up" },
    });
  });

  it("refuses providers that can't receive server imports", async () => {
    drive.driveFileMeta.mockResolvedValueOnce({
      id: "f1234567890",
      name: "a.png",
      mimeType: "image/png",
      size: 10,
    });
    provider.importer = undefined;
    await expect(createDriveImport("acc1", "f1234567890")).rejects.toThrow(
      /can't receive server imports/,
    );
    provider.importer = importer;
  });
});

describe("kicks, progress and retry", () => {
  it("accepts only fresh, correctly signed kicks", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    expect(verifyKick("a1", exp, signKick("a1", exp))).toBe(true);
    expect(verifyKick("a2", exp, signKick("a1", exp))).toBe(false);
    expect(verifyKick("a1", exp + 1, signKick("a1", exp))).toBe(false);
    expect(verifyKick("a1", exp - 120, signKick("a1", exp - 120))).toBe(false);
    expect(verifyKick("a1", String(exp), signKick("a1", exp))).toBe(false);
  });

  it("re-kicks stalled imports when progress is polled", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    seed({ bytesDone: BigInt(4), updatedAt: new Date(Date.now() - 60_000) });
    const [p] = await importProgress(["a1"]);
    expect(p).toEqual({
      assetId: "a1",
      status: "RUNNING",
      bytesDone: 4,
      bytesTotal: 10,
      error: null,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(verifyKick(body.assetId, body.exp, body.sig)).toBe(true);

    // A job that's moving (fresh lease) is left alone
    fetchMock.mockClear();
    seed({ leaseUntil: new Date(Date.now() + 60_000) });
    await importProgress(["a1"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retry resets a failed import and kicks it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 202 })),
    );
    seed({ status: "FAILED", attempts: 5, error: "quota", bytesDone: BigInt(4) });
    store.assets.get("a1")!.status = "ERRORED";
    await retryImport("a1");
    expect(store.jobs.get("a1")).toMatchObject({
      status: "RUNNING",
      attempts: 0,
      error: null,
      bytesDone: BigInt(4),
    });
    expect(store.assets.get("a1")!.status).toBe("UPLOADING");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
