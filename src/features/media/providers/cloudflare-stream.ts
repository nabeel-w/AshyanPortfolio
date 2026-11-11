import type { ProviderResult, StorageProvider } from "../types";
import { expectOk, freshTimestamp, hmac, parseSigHeader, safeEqualHex } from "../util";

/**
 * Cloudflare Stream — HLS/DASH, flat per-minute pricing.
 * Uses Direct Creator Uploads (browser POSTs multipart form data, files up to 200 MB).
 * Larger masters need the tus resumable protocol — add a "tus" UploadInstruction when needed.
 * providerKey = the video uid.
 */
function base() {
  return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`, "Content-Type": "application/json" },
  });
  await expectOk(res, `Cloudflare Stream ${path || "/"}`);
  if (init?.method === "DELETE") return undefined as T;
  return ((await res.json()) as { result: T }).result;
}

type CfVideo = {
  uid: string;
  readyToStream: boolean;
  status?: { state?: string; errorReasonText?: string };
  duration?: number;
  input?: { width?: number; height?: number };
  size?: number;
};

const customer = () => `https://customer-${process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com`;

function fromVideo(v: CfVideo): ProviderResult {
  if (v.status?.state === "error") return { status: "ERRORED", meta: { error: v.status.errorReasonText } };
  if (!v.readyToStream) return { status: "PROCESSING" };
  return {
    status: "READY",
    playbackId: v.uid,
    duration: v.duration,
    width: v.input?.width,
    height: v.input?.height,
    bytes: v.size,
    url: `${customer()}/${v.uid}/thumbnails/thumbnail.jpg?time=1s`,
    meta: {
      hls: `${customer()}/${v.uid}/manifest/video.m3u8`,
      animated: `${customer()}/${v.uid}/thumbnails/thumbnail.gif?time=1s&duration=4s&height=360`,
    },
  };
}

export const cloudflareStream: StorageProvider = {
  id: "cloudflare-stream",
  label: "Cloudflare Stream",
  kinds: ["VIDEO"],
  requiredEnv: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_STREAM_API_TOKEN", "CLOUDFLARE_STREAM_CUSTOMER_CODE"],
  optionalEnv: ["CLOUDFLARE_STREAM_WEBHOOK_SECRET"],
  setup:
    "Cloudflare dashboard → Stream: copy the account id and customer code (customer-<code>.cloudflarestream.com); create an API token with Stream:Edit. Register a webhook to <site>/api/media/webhooks/cloudflare-stream.",

  async createUpload({ filename }) {
    const res = await api<{ uid: string; uploadURL: string }>("/direct_upload", {
      method: "POST",
      body: JSON.stringify({ maxDurationSeconds: 3 * 60 * 60, meta: { name: filename } }),
    });
    return { providerKey: res.uid, upload: { strategy: "form-post", url: res.uploadURL, fieldName: "file" } };
  },

  async finalize(uid) {
    return fromVideo(await api<CfVideo>(`/${uid}`));
  },

  async delete(uid) {
    await api(`/${uid}`, { method: "DELETE" });
  },

  async webhook(request) {
    const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
    if (!secret) throw new Error("CLOUDFLARE_STREAM_WEBHOOK_SECRET is not set");
    const raw = await request.text();
    const sig = parseSigHeader(request.headers.get("webhook-signature"));
    if (!freshTimestamp(sig.time) || !sig.sig1 || !safeEqualHex(hmac(secret, `${sig.time}.${raw}`), sig.sig1)) {
      throw new Error("Invalid Cloudflare Stream webhook signature");
    }
    const video = JSON.parse(raw) as CfVideo;
    return video.uid ? { providerKey: video.uid, result: fromVideo(video) } : null;
  },

  async check() {
    await api("?limit=1");
    return "credentials valid";
  },
};
