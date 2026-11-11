import type { ProviderResult, StorageProvider } from "../types";
import { expectOk, freshTimestamp, hmac, parseSigHeader, safeEqualHex } from "../util";

/**
 * Mux Video — adaptive HLS, instant thumbnails/animated previews, Mux Data.
 * Flow: create a Direct Upload (browser PUTs the file) → Mux creates + transcodes an asset →
 * `video.asset.ready` webhook (or finalize polling) marks it READY with a playback id.
 * providerKey = the Direct Upload id (stable from the moment the upload is created).
 *
 * MUX_VIDEO_QUALITY: basic (free encoding) | plus | premium — see docs/07-storage-costs.md.
 */
const API = "https://api.mux.com/video/v1";

function headers() {
  const auth = Buffer.from(`${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`).toString("base64");
  return { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await expectOk(await fetch(`${API}${path}`, { ...init, headers: headers() }), `Mux ${path}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as { data: T }).data;
}

type MuxAsset = {
  id: string;
  status: "preparing" | "ready" | "errored";
  duration?: number;
  aspect_ratio?: string;
  max_stored_resolution?: string;
  playback_ids?: { id: string; policy: string }[];
  upload_id?: string;
  errors?: { messages?: string[] };
};

function fromAsset(asset: MuxAsset): ProviderResult {
  if (asset.status === "errored") {
    return { status: "ERRORED", meta: { assetId: asset.id, error: asset.errors?.messages?.join("; ") } };
  }
  const playbackId = asset.playback_ids?.find((p) => p.policy === "public")?.id;
  if (asset.status !== "ready" || !playbackId) return { status: "PROCESSING", meta: { assetId: asset.id } };
  const [w, h] = (asset.aspect_ratio ?? "16:9").split(":").map(Number);
  return {
    status: "READY",
    playbackId,
    duration: asset.duration,
    url: `https://image.mux.com/${playbackId}/thumbnail.webp?time=1`,
    meta: {
      assetId: asset.id,
      hls: `https://stream.mux.com/${playbackId}.m3u8`,
      animated: `https://image.mux.com/${playbackId}/animated.webp?width=640&fps=15`,
      aspectRatio: w && h ? w / h : undefined,
      resolution: asset.max_stored_resolution,
    },
  };
}

export const mux: StorageProvider = {
  id: "mux",
  label: "Mux Video",
  kinds: ["VIDEO"],
  requiredEnv: ["MUX_TOKEN_ID", "MUX_TOKEN_SECRET"],
  optionalEnv: ["MUX_WEBHOOK_SECRET", "MUX_VIDEO_QUALITY"],
  setup:
    "Mux dashboard → Settings → Access Tokens (Mux Video read+write) → MUX_TOKEN_ID/SECRET. Add a webhook to <site>/api/media/webhooks/mux and copy its signing secret to MUX_WEBHOOK_SECRET.",

  async createUpload() {
    const upload = await api<{ id: string; url: string }>("/uploads", {
      method: "POST",
      body: JSON.stringify({
        cors_origin: process.env.NEXT_PUBLIC_SITE_URL ?? "*",
        new_asset_settings: {
          playback_policies: ["public"],
          video_quality: process.env.MUX_VIDEO_QUALITY ?? "basic",
          // Small MP4 for hover loops / social embeds.
          static_renditions: [{ resolution: "highest" }],
        },
      }),
    });
    return { providerKey: upload.id, upload: { strategy: "put", url: upload.url } };
  },

  async finalize(uploadId) {
    const upload = await api<{ status: string; asset_id?: string }>(`/uploads/${uploadId}`);
    if (!upload.asset_id) {
      return upload.status === "errored" || upload.status === "cancelled"
        ? { status: "ERRORED", meta: { error: `upload ${upload.status}` } }
        : { status: "PROCESSING" };
    }
    return fromAsset(await api<MuxAsset>(`/assets/${upload.asset_id}`));
  },

  async delete(uploadId) {
    const upload = await api<{ asset_id?: string; status: string }>(`/uploads/${uploadId}`).catch(() => null);
    if (upload?.asset_id) await api(`/assets/${upload.asset_id}`, { method: "DELETE" });
    else if (upload?.status === "waiting") await api(`/uploads/${uploadId}/cancel`, { method: "PUT" });
  },

  async webhook(request) {
    const secret = process.env.MUX_WEBHOOK_SECRET;
    if (!secret) throw new Error("MUX_WEBHOOK_SECRET is not set");
    const raw = await request.text();
    const sig = parseSigHeader(request.headers.get("mux-signature"));
    if (!freshTimestamp(sig.t) || !sig.v1 || !safeEqualHex(hmac(secret, `${sig.t}.${raw}`), sig.v1)) {
      throw new Error("Invalid Mux webhook signature");
    }
    const event = JSON.parse(raw) as { type: string; data: MuxAsset };
    if (!["video.asset.ready", "video.asset.errored"].includes(event.type) || !event.data.upload_id) return null;
    return { providerKey: event.data.upload_id, result: fromAsset(event.data) };
  },

  async check() {
    await api("/assets?limit=1");
    return "credentials valid";
  },
};
