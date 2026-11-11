import { timingSafeEqual } from "node:crypto";
import { runRollups } from "@/features/analytics/rollup";
import { env } from "@/lib/env";

/**
 * Nightly analytics rollup + retention (vercel.json crons). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without the secret configured the route is closed.
 */
export async function GET(request: Request) {
  const secret = env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await runRollups();
  return Response.json({ ok: true, ...result });
}
