import "server-only";
import { revalidateTag } from "next/cache";
import type { AssetImport, Prisma } from "@/generated/prisma/client";
import { tags } from "@/features/content/tags";
import { driveFileMeta, driveReadRange } from "@/features/google/drive";
import { db } from "@/lib/db";
import { completeUpload, validateUpload } from "./service";
import { getProvider, providerFor } from "./providers";
import {
  IMPORT_CHUNK_BYTES,
  type ImportContext,
  type ImportState,
  PermanentImportError,
  type ProviderImporter,
} from "./types";
import { hmac, makeKey, safeEqualHex } from "./util";

/**
 * Server-to-server imports (Google Drive → the storage provider for that media kind).
 *
 *   createDriveImport → Asset (UPLOADING) + AssetImport (RUNNING)
 *   kickImport → POST /api/media/import (signed) → runImport in `after()`, chunk by chunk:
 *       read 16 MiB from the source (HTTP Range) → importer.part() → save bytesDone + state
 *   out of time → the route kicks itself again; a failed chunk retries in place, then the whole run
 *   retries later from the last saved chunk; after MAX_ATTEMPTS the import (and asset) fail.
 *   last chunk → importer.complete() → completeUpload() (same finalize/webhook pipeline as browser uploads)
 *
 * A short lease (leaseUntil) makes sure only one runner moves a file at a time. If a function dies,
 * the lease expires and the admin's progress polling (importProgress) kicks the import again.
 */

const LEASE_MS = 2 * 60 * 1000;
/** Runs stop starting new chunks after this long and hand over to a fresh invocation (route maxDuration is 300 s). */
export const RUN_BUDGET_MS = 230 * 1000;
const MAX_ATTEMPTS = 5;
const CHUNK_TRIES = 3;
/** A RUNNING import with no lease and no progress for this long is considered stalled. */
const STALL_MS = 20 * 1000;

export type ImportSource = "google-drive";

// ─── Creating ────────────────────────────────────────────────────────────────

/** Validate a picked Drive file and start importing it. Returns the new asset id. */
export async function createDriveImport(accountId: string, fileId: string): Promise<string> {
  const file = await driveFileMeta(accountId, fileId);
  const kind = validateUpload(file.mimeType, file.size);
  const provider = providerFor(kind);
  if (!provider.importer) {
    throw new Error(
      `The ${provider.label} provider can't receive server imports yet. Upload this file from your device instead.`,
    );
  }
  const key = makeKey(kind, file.name);
  const { providerKey, state } = await provider.importer.begin({
    key,
    filename: file.name,
    mimeType: file.mimeType,
    bytes: file.size,
    kind,
  });
  const asset = await db.asset.create({
    data: {
      kind,
      provider: provider.id,
      providerKey,
      status: "UPLOADING",
      filename: file.name,
      mimeType: file.mimeType,
      bytes: BigInt(file.size),
      meta: { import: { source: "google-drive", fileId: file.id, md5: file.md5Checksum ?? null } },
      import: {
        create: {
          source: "google-drive",
          sourceId: file.id,
          accountId,
          bytesTotal: BigInt(file.size),
          state: state as Prisma.InputJsonValue,
        },
      },
    },
  });
  return asset.id;
}

// ─── Running ─────────────────────────────────────────────────────────────────

function readSource(
  job: Pick<AssetImport, "source" | "sourceId" | "accountId">,
  start: number,
  end: number,
) {
  switch (job.source as ImportSource) {
    case "google-drive":
      return driveReadRange(job.accountId, job.sourceId, start, end);
    default:
      throw new PermanentImportError(`Unknown import source "${job.source}"`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry a chunk step in place a couple of times (network blips, 5xx, rate limits). */
async function withRetries<T>(
  fn: () => Promise<T>,
  tries = CHUNK_TRIES,
  baseMs = 1000,
): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof PermanentImportError || i >= tries) throw e;
      await sleep(baseMs * 3 ** (i - 1));
    }
  }
}

/** Take the lease if nobody holds it. Atomic: exactly one concurrent caller wins. */
async function acquireLease(assetId: string): Promise<boolean> {
  const now = new Date();
  const { count } = await db.assetImport.updateMany({
    where: { assetId, status: "RUNNING", OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    data: { leaseUntil: new Date(now.getTime() + LEASE_MS) },
  });
  return count === 1;
}

export type RunResult =
  | { status: "done" | "busy" | "gone" }
  | { status: "paused"; bytesDone: number }
  | { status: "retry"; attempts: number; error: string }
  | { status: "failed"; error: string };

/**
 * Move as many chunks as fit in `budgetMs`, saving progress after each one.
 * Safe to call any number of times concurrently: only the lease holder works.
 */
export async function runImport(
  assetId: string,
  { budgetMs = RUN_BUDGET_MS, retryDelayMs = 1000 } = {},
): Promise<RunResult> {
  const deadline = Date.now() + budgetMs;
  if (!(await acquireLease(assetId))) {
    const exists = await db.assetImport.findUnique({
      where: { assetId },
      select: { status: true },
    });
    return { status: exists?.status === "RUNNING" ? "busy" : "gone" };
  }
  const job = await db.assetImport.findUnique({ where: { assetId }, include: { asset: true } });
  if (!job) return { status: "gone" };

  const importer = getProvider(job.asset.provider).importer;
  const total = Number(job.bytesTotal);
  let done = Number(job.bytesDone);
  const ctx: ImportContext = {
    providerKey: job.asset.providerKey,
    state: (job.state ?? {}) as ImportState,
    total,
    mimeType: job.asset.mimeType,
    filename: job.asset.filename,
  };

  try {
    if (!importer)
      throw new PermanentImportError(
        `Provider "${job.asset.provider}" can't receive server imports.`,
      );
    // After a crash the provider may hold more (or less) than we recorded; ask it when it can tell us.
    if (done > 0 && importer.offset)
      done = await withRetries(() => importer.offset!(ctx), CHUNK_TRIES, retryDelayMs);

    while (done < total) {
      if (Date.now() > deadline) {
        await db.assetImport.update({ where: { assetId }, data: { leaseUntil: null } });
        return { status: "paused", bytesDone: done };
      }
      done = await moveChunk(job, importer, ctx, done, retryDelayMs);
      await db.assetImport.update({
        where: { assetId },
        data: {
          bytesDone: BigInt(done),
          state: ctx.state as Prisma.InputJsonValue,
          leaseUntil: new Date(Date.now() + LEASE_MS),
          attempts: 0,
          error: null,
        },
      });
    }

    await withRetries(() => importer.complete(ctx), CHUNK_TRIES, retryDelayMs);
    await db.assetImport.update({ where: { assetId }, data: { status: "DONE", leaseUntil: null } });
    await completeUpload(assetId);
    revalidateTag(tags.assets, "max");
    return { status: "done" };
  } catch (e) {
    return fail(job, ctx, e);
  }
}

/** Read one chunk from the source and hand it to the provider. Returns the next offset. */
async function moveChunk(
  job: AssetImport,
  importer: ProviderImporter,
  ctx: ImportContext,
  offset: number,
  retryDelayMs: number,
) {
  const end = Math.min(offset + IMPORT_CHUNK_BYTES, ctx.total) - 1;
  const bytes = await withRetries(() => readSource(job, offset, end), CHUNK_TRIES, retryDelayMs);
  const res = await withRetries(
    () =>
      importer.part(
        {
          ...ctx,
          offset,
          partNumber: Math.floor(offset / IMPORT_CHUNK_BYTES) + 1,
          last: end + 1 >= ctx.total,
        },
        bytes,
      ),
    CHUNK_TRIES,
    retryDelayMs,
  );
  if (res.state) ctx.state = res.state;
  const next = res.nextOffset ?? end + 1;
  if (next <= offset && next < ctx.total)
    throw new Error(`Provider made no progress at byte ${offset}`);
  return next;
}

async function fail(job: AssetImport, ctx: ImportContext, e: unknown): Promise<RunResult> {
  const error = e instanceof Error ? e.message : String(e);
  const attempts = job.attempts + 1;
  const permanent = e instanceof PermanentImportError || attempts >= MAX_ATTEMPTS;
  console.warn(
    `[media] import ${job.assetId} ${permanent ? "failed" : "will retry"} (attempt ${attempts}):`,
    error,
  );
  try {
    await db.assetImport.update({
      where: { assetId: job.assetId },
      data: {
        attempts,
        error,
        leaseUntil: null,
        state: ctx.state as Prisma.InputJsonValue,
        ...(permanent ? { status: "FAILED" as const } : {}),
      },
    });
    if (permanent) {
      await db.asset.update({ where: { id: job.assetId }, data: { status: "ERRORED" } });
      revalidateTag(tags.assets, "max");
    }
  } catch {
    // The asset was deleted mid-import (cascade removed the job): nothing left to record.
    return { status: "gone" };
  }
  // A failed import keeps its provider-side session, so Retry resumes from the last saved chunk.
  return permanent ? { status: "failed", error } : { status: "retry", attempts, error };
}

// ─── Kicking (self-chaining across function invocations) ─────────────────────

const KICK_TTL_S = 5 * 60;

function kickSecret() {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is required to sign import runs");
  return s;
}

export function signKick(assetId: string, exp: number) {
  return hmac(kickSecret(), `media-import:${assetId}:${exp}`);
}

export function verifyKick(assetId: unknown, exp: unknown, sig: unknown): assetId is string {
  if (typeof assetId !== "string" || typeof exp !== "number" || typeof sig !== "string")
    return false;
  if (exp < Date.now() / 1000) return false;
  return safeEqualHex(signKick(assetId, exp), sig);
}

/**
 * Start (or continue) an import in a fresh function invocation: POST /api/media/import, which
 * answers 202 at once and does the work in `after()`. Never throws; a missed kick is retried by
 * the admin's progress polling.
 */
export async function kickImport(assetId: string): Promise<boolean> {
  const exp = Math.floor(Date.now() / 1000) + KICK_TTL_S;
  const base = (process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(
    /\/$/,
    "",
  );
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  try {
    const res = await fetch(`${base}/api/media/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bypass ? { "x-vercel-protection-bypass": bypass } : {}),
      },
      body: JSON.stringify({ assetId, exp, sig: signKick(assetId, exp) }),
    });
    return res.status === 202;
  } catch (e) {
    console.warn(`[media] could not kick import ${assetId}:`, e);
    return false;
  }
}

/** What the import route does after answering: one budgeted run, then hand over if needed. */
export async function continueImport(assetId: string) {
  const result = await runImport(assetId);
  if (result.status === "paused") await kickImport(assetId);
  if (result.status === "retry") {
    await sleep(Math.min(30_000, 5_000 * result.attempts));
    await kickImport(assetId);
  }
  return result;
}

// ─── Progress, retry ─────────────────────────────────────────────────────────

export type ImportProgress = {
  assetId: string;
  status: "RUNNING" | "DONE" | "FAILED";
  bytesDone: number;
  bytesTotal: number;
  error: string | null;
};

export function toProgress(
  j: Pick<AssetImport, "assetId" | "status" | "bytesDone" | "bytesTotal" | "error">,
): ImportProgress {
  return {
    assetId: j.assetId,
    status: j.status,
    bytesDone: Number(j.bytesDone),
    bytesTotal: Number(j.bytesTotal),
    error: j.error,
  };
}

/** Progress for the admin UI. Also the safety net: stalled imports (dead function, missed kick) are kicked again. */
export async function importProgress(assetIds: string[]): Promise<ImportProgress[]> {
  const jobs = await db.assetImport.findMany({ where: { assetId: { in: assetIds } } });
  const now = Date.now();
  const stalled = jobs.filter(
    (j) =>
      j.status === "RUNNING" &&
      (!j.leaseUntil || j.leaseUntil.getTime() < now) &&
      now - j.updatedAt.getTime() > STALL_MS,
  );
  for (const j of stalled) {
    // Touch updatedAt first so concurrent pollers don't all kick the same import.
    await db.assetImport.update({ where: { assetId: j.assetId }, data: { leaseUntil: null } });
    void kickImport(j.assetId);
  }
  return jobs.map(toProgress);
}

/** Start a failed import again from its last saved chunk. */
export async function retryImport(assetId: string) {
  await db.assetImport.update({
    where: { assetId },
    data: { status: "RUNNING", attempts: 0, error: null, leaseUntil: null },
  });
  await db.asset.update({ where: { id: assetId }, data: { status: "UPLOADING" } });
  await kickImport(assetId);
}
