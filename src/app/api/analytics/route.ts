import { clientEventSchema, recordEvent } from "@/features/analytics/ingest";

/**
 * Beacon endpoint (docs/04). Same-origin only, tiny bodies, always 204 for valid input so
 * filtered requests (bots, admins, rate limits) look identical to stored ones.
 */
export async function POST(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  if (site ? site !== "same-origin" : origin && new URL(origin).host !== new URL(request.url).host) {
    return new Response(null, { status: 403 });
  }

  const text = await request.text();
  if (text.length > 2048) return new Response(null, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = clientEventSchema.safeParse(json);
  if (!parsed.success) return new Response(null, { status: 400 });

  const e = parsed.data;
  try {
    await recordEvent({ type: e.t, path: e.p, referrer: e.r, search: e.q, value: e.v, label: e.l }, request.headers);
  } catch (error) {
    console.warn("[analytics] ingest failed", error);
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
