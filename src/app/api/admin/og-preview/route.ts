import { z } from "zod";
import { OG_CONTENT_TYPE } from "@/features/seo/og-card";
import { renderShareCard } from "@/features/seo/og-template";
import { pageShareSchema, siteShareSchema } from "@/features/seo/share";
import { shareCardFor } from "@/features/seo/share-server";
import { auth } from "@/lib/auth";

/**
 * Live share-card preview for Settings → Sharing & SEO and the page/project editors (#33).
 * Renders an unsaved draft with the production renderer and encoder (fonts fetched uncached), for the
 * chosen page. Admin only; never cached or indexed.
 */
const body = z.object({
  target: z.object({ kind: z.enum(["page", "project", "label"]), slug: z.string().regex(/^[a-z0-9-]{1,80}$/) }),
  settings: siteShareSchema.optional(),
  override: pageShareSchema.optional(),
});

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || session.user.role !== "ADMIN") return new Response("Unauthorized", { status: 401, headers: NO_STORE });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400, headers: NO_STORE });

  const { target, settings, override } = parsed.data;
  const card = await shareCardFor(target, { settings, override });
  if (!card) return Response.json({ error: "Nothing to preview for that page" }, { status: 404, headers: NO_STORE });

  const jpeg = await renderShareCard(card.input, { preview: true });
  return new Response(new Uint8Array(jpeg), {
    headers: { ...NO_STORE, "Content-Type": OG_CONTENT_TYPE, "X-Share-Version": card.version },
  });
}
