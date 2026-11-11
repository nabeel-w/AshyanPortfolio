import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { localPath, localSignature } from "@/features/media/providers/local";
import { safeEqualHex } from "@/features/media/util";

/**
 * Receives PUT uploads for the dev-only "local" provider. Authorised by the signed, expiring URL
 * minted in createUpload — same model as an S3 presigned URL. Disabled in production.
 */
export async function PUT(request: Request, { params }: RouteContext<"/api/media/local/[...key]">) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });

  const key = (await params).key.join("/");
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get("expires"));
  const sig = url.searchParams.get("sig") ?? "";

  if (!Number.isFinite(expires) || expires < Date.now() / 1000 || !safeEqualHex(localSignature(key, expires), sig)) {
    return new Response("Invalid or expired upload URL", { status: 403 });
  }
  if (!request.body) return new Response("Empty body", { status: 400 });

  let target: string;
  try {
    target = localPath(key);
  } catch {
    return new Response("Invalid key", { status: 400 });
  }
  await mkdir(path.dirname(target), { recursive: true });
  await pipeline(Readable.fromWeb(request.body as WebReadableStream), createWriteStream(target));
  return new Response(null, { status: 200 });
}
