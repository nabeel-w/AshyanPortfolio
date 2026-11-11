import "server-only";
import { PermanentImportError } from "@/features/media/types";
import { GoogleAuthError, googleAccessToken } from "./accounts";

/**
 * Google Drive as an import source. With the drive.file scope we can only read files the admin
 * picked in the Google Picker, which is exactly what we need (and keeps the scope non-sensitive).
 */
const API = "https://www.googleapis.com/drive/v3/files";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  md5Checksum?: string;
};

/** Drive ids are URL-safe base64-ish strings. Anything else never reaches the API. */
export function isDriveFileId(id: string): boolean {
  return /^[A-Za-z0-9_-]{10,200}$/.test(id);
}

/** Drive error body → a message the admin can act on, flagged permanent when retrying won't help. */
export async function driveError(res: Response, what: string): Promise<Error> {
  let reason = "";
  let message = res.statusText;
  try {
    const body = (await res.json()) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    reason = body.error?.errors?.[0]?.reason ?? "";
    message = body.error?.message ?? message;
  } catch {
    // non-JSON error body
  }
  if (reason === "downloadQuotaExceeded") {
    return new PermanentImportError(
      "Google Drive's download quota for this file is used up. Try again in a few hours.",
    );
  }
  if (res.status === 404 || reason === "notFound")
    return new PermanentImportError("The file is no longer available in Google Drive.");
  if (reason === "cannotDownloadAbusiveFile")
    return new PermanentImportError(
      "Google Drive flagged this file and won't let it be downloaded.",
    );
  if (res.status === 403 && !/rateLimitExceeded|userRateLimitExceeded/.test(reason)) {
    return new PermanentImportError(
      `Google Drive refused access (${reason || res.status}). Pick the file again in the Drive tab.`,
    );
  }
  // 401 (token just expired), 429, rate limits and 5xx are worth retrying.
  return new Error(`${what} failed: ${res.status} ${reason || message}`.trim());
}

async function token(accountId: string) {
  try {
    return await googleAccessToken(accountId);
  } catch (e) {
    throw e instanceof GoogleAuthError ? new PermanentImportError(e.message) : e;
  }
}

export async function driveFileMeta(accountId: string, fileId: string): Promise<DriveFile> {
  if (!isDriveFileId(fileId)) throw new PermanentImportError("Invalid Google Drive file id.");
  const res = await fetch(
    `${API}/${fileId}?fields=id,name,mimeType,size,md5Checksum&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${await token(accountId)}` },
    },
  );
  if (!res.ok) throw await driveError(res, "Drive metadata");
  const f = (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    md5Checksum?: string;
  };
  // Google-native Docs/Sheets/Slides have no size and no binary content.
  if (!f.size)
    throw new PermanentImportError(
      `"${f.name}" is a Google ${f.mimeType.split(".").pop() ?? "Docs"} file, not an uploadable file.`,
    );
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: Number(f.size),
    md5Checksum: f.md5Checksum,
  };
}

/** Bytes [start, endInclusive] of a Drive file (HTTP Range → 206). */
export async function driveReadRange(
  accountId: string,
  fileId: string,
  start: number,
  endInclusive: number,
) {
  const res = await fetch(`${API}/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: {
      Authorization: `Bearer ${await token(accountId)}`,
      Range: `bytes=${start}-${endInclusive}`,
    },
  });
  if (!res.ok) throw await driveError(res, "Drive download");
  const bytes = new Uint8Array(await res.arrayBuffer());
  const expected = endInclusive - start + 1;
  // A 200 means the server ignored Range and sent the whole file — only acceptable if that's what we asked for.
  if (bytes.byteLength !== expected)
    throw new Error(`Drive download returned ${bytes.byteLength} bytes, expected ${expected}`);
  return bytes;
}
