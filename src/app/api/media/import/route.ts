import { after } from "next/server";
import { continueImport, verifyKick } from "@/features/media/import";

/**
 * Runs a server-side media import (Google Drive → storage provider) in its own invocation.
 * Only our server calls this, with an HMAC-signed, 5-minute token (features/media/import.ts kickImport).
 * Answers 202 straight away and moves chunks in `after()` for up to ~4 minutes, then kicks itself again.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    assetId?: unknown;
    exp?: unknown;
    sig?: unknown;
  } | null;
  if (!body || !verifyKick(body.assetId, body.exp, body.sig)) {
    return Response.json({ ok: false }, { status: 403 });
  }
  const assetId = body.assetId as string;
  after(async () => {
    try {
      await continueImport(assetId);
    } catch (e) {
      console.error(`[media] import ${assetId} crashed:`, e);
    }
  });
  return Response.json({ ok: true }, { status: 202 });
}
