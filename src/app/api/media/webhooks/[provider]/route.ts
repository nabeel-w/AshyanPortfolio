import { revalidateTag } from "next/cache";
import { tags } from "@/features/content/tags";
import { applyWebhook } from "@/features/media/service";

/**
 * Provider webhooks (e.g. Mux `video.asset.ready`): /api/media/webhooks/<provider id>.
 * The provider adapter verifies the signature; anything unsigned or stale is rejected with 401.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/media/webhooks/[provider]">) {
  const { provider } = await params;
  try {
    const asset = await applyWebhook(provider, request);
    if (asset) {
      revalidateTag(tags.assets, "max");
      revalidateTag(tags.projects, "max");
    }
    return Response.json({ ok: true, updated: asset?.id ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Webhook error";
    const status = /signature|not set/i.test(message) ? 401 : /unknown media provider|no webhook/i.test(message) ? 404 : 500;
    if (status === 500) console.error(`[media] webhook ${provider} failed:`, e);
    return Response.json({ ok: false, error: status === 500 ? "Internal error" : message }, { status });
  }
}
