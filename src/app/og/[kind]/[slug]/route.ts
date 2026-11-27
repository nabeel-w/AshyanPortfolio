import { OG_CONTENT_TYPE } from "@/features/seo/og-card";
import { renderShareCard } from "@/features/seo/og-template";
import { shareCardFor, type ShareTarget } from "@/features/seo/share-server";

/**
 * Every share card on the site (#33): /og/page/<home|work|about|contact>, /og/project/<slug>,
 * /og/label/<slug>. Pages link here with ?v=<content hash>, so the CDN may cache each URL for a
 * year and a changed card gets a new URL (chat apps refetch).
 */
const KINDS = new Set<ShareTarget["kind"]>(["page", "project", "label"]);

export async function GET(_request: Request, ctx: RouteContext<"/og/[kind]/[slug]">) {
  const { kind, slug } = await ctx.params;
  if (!KINDS.has(kind as ShareTarget["kind"]) || !/^[a-z0-9-]{1,80}$/.test(slug)) {
    return new Response("Not found", { status: 404 });
  }
  const card = await shareCardFor({ kind: kind as ShareTarget["kind"], slug });
  if (!card) return new Response("Not found", { status: 404 });
  const jpeg = await renderShareCard(card.input);
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": OG_CONTENT_TYPE,
      "Cache-Control": "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400",
    },
  });
}
