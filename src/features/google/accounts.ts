import "server-only";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { type GoogleAccountInfo, type GoogleFeature, GOOGLE_SCOPES, hasFeature } from "./scopes";

/**
 * Linked Google accounts (Better Auth `Account` rows with providerId "google"). No tables of our own:
 * tokens live encrypted in `account`, Better Auth refreshes them, and the granted scopes say which
 * features (Drive, Gmail) each account can serve.
 */

export class GoogleAuthError extends Error {
  override name = "GoogleAuthError";
}

export function googleConfigured(): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function pickerConfigured(): boolean {
  return (
    googleConfigured() &&
    !!(env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY && env.NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER)
  );
}

/** The email inside the id token saved at link time (already verified by Better Auth then). */
export function emailFromIdToken(idToken: string | null | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
    };
    return typeof claims.email === "string" ? claims.email : null;
  } catch {
    return null;
  }
}

type AccountRow = { id: string; userId: string; scope: string | null; idToken: string | null };

function toInfo(a: AccountRow): GoogleAccountInfo {
  return {
    id: a.id,
    email: emailFromIdToken(a.idToken),
    drive: hasFeature(a.scope, "drive"),
    gmail: hasFeature(a.scope, "gmail"),
  };
}

const select = { id: true, userId: true, scope: true, idToken: true } as const;

/** Google accounts linked by this admin, newest first. */
export async function listGoogleAccounts(userId: string): Promise<GoogleAccountInfo[]> {
  const rows = await db.account.findMany({
    where: { providerId: "google", userId },
    select,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toInfo);
}

/**
 * The newest linked account that granted `feature`. Without `userId` (e.g. a public contact form
 * sending a notification) any admin's account will do.
 */
export async function googleAccountFor(
  feature: GoogleFeature,
  userId?: string,
): Promise<(GoogleAccountInfo & { userId: string }) | null> {
  const rows = await db.account.findMany({
    where: {
      providerId: "google",
      scope: { contains: GOOGLE_SCOPES[feature] },
      ...(userId ? { userId } : { user: { role: "ADMIN" } }),
    },
    select,
    orderBy: { updatedAt: "desc" },
  });
  const row = rows.find((r) => hasFeature(r.scope, feature));
  return row ? { ...toInfo(row), userId: row.userId } : null;
}

/** A valid access token for a linked account; Better Auth refreshes (and re-encrypts) it when it's about to expire. */
export async function googleAccessToken(accountId: string): Promise<string> {
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { userId: true, providerId: true },
  });
  if (!account || account.providerId !== "google")
    throw new GoogleAuthError("The Google account is no longer connected.");
  try {
    // Server-side call with no headers: Better Auth trusts the explicit userId.
    const { accessToken } = await auth.api.getAccessToken({
      body: { accountId, userId: account.userId },
    });
    if (!accessToken) throw new Error("empty token");
    return accessToken;
  } catch {
    throw new GoogleAuthError(
      "Google access has expired or was revoked. Reconnect Google and try again.",
    );
  }
}

/** Revoke the grant at Google (all scopes) and remove the link. Revoking is best-effort. */
export async function disconnectGoogle(accountId: string, userId: string) {
  const token = await googleAccessToken(accountId).catch(() => null);
  if (token) {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    }).catch(() => null);
  }
  await db.account.deleteMany({ where: { id: accountId, userId, providerId: "google" } });
}
