import type { ProviderResult, StorageProvider } from "../types";
import { expectOk, freshTimestamp, hmac, parseSigHeader, safeEqualHex } from "../util";

/**
 * Cloudflare Stream — HLS/DASH, flat per-minute pricing.
 * Uses Direct Creator Uploads (browser POSTs multipart form data, files up to 200 MB).
 * Larger browser uploads need the tus resumable protocol — add a "tus" UploadInstruction when needed.
 * Server imports already use tus (see `importer`), so Drive masters of any size work.
 * providerKey = the video uid.
 */
function base() {
  return `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
      "Content-Type": "application/json",
    },
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

const customer = () =>
  `https://customer-${process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE}.cloudflarestream.com`;

function fromVideo(v: CfVideo): ProviderResult {
  if (v.status?.state === "error")
    return { status: "ERRORED", meta: { error: v.status.errorReasonText } };
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
  requiredEnv: [
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_STREAM_API_TOKEN",
    "CLOUDFLARE_STREAM_CUSTOMER_CODE",
  ],
  optionalEnv: ["CLOUDFLARE_STREAM_WEBHOOK_SECRET"],
  setup:
    "Cloudflare dashboard → Stream: copy the account id and customer code (customer-<code>.cloudflarestream.com); create an API token with Stream:Edit. Register a webhook to <site>/api/media/webhooks/cloudflare-stream.",

  async createUpload({ filename }) {
    const res = await api<{ uid: string; uploadURL: string }>("/direct_upload", {
      method: "POST",
      body: JSON.stringify({ maxDurationSeconds: 3 * 60 * 60, meta: { name: filename } }),
    });
    return {
      providerKey: res.uid,
      upload: { strategy: "form-post", url: res.uploadURL, fieldName: "file" },
    };
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
    if (
      !freshTimestamp(sig.time) ||
      !sig.sig1 ||
      !safeEqualHex(hmac(secret, `${sig.time}.${raw}`), sig.sig1)
    ) {
      throw new Error("Invalid Cloudflare Stream webhook signature");
    }
    const video = JSON.parse(raw) as CfVideo;
    return video.uid ? { providerKey: video.uid, result: fromVideo(video) } : null;
  },

  async check() {
    await api("?limit=1");
    return "credentials valid";
  },

  // Server imports: tus resumable upload (POST creates it, PATCH appends at Upload-Offset, HEAD resumes).
  importer: {
    async begin({ filename, bytes }) {
      const res = await expectOk(
        await fetch(base(), {
          method: "POST",
          headers: {
            ...tusHeaders(),
            "Upload-Length": String(bytes),
            "Upload-Metadata": `name ${Buffer.from(filename).toString("base64")}`,
          },
        }),
        "Cloudflare Stream tus create",
      );
      const url = res.headers.get("location");
      const uid = res.headers.get("stream-media-id");
      if (!url || !uid)
        throw new Error("Cloudflare Stream tus create: missing Location or stream-media-id");
      return { providerKey: uid, state: { url } };
    },
    offset: ({ state }) => tusOffset(String(state.url)),
    async part({ state, offset }, bytes) {
      const res = await fetch(String(state.url), {
        method: "PATCH",
        headers: {
          ...tusHeaders(),
          "Upload-Offset": String(offset),
          "Content-Type": "application/offset+octet-stream",
        },
        body: bytes,
      });
      // 409: our offset is stale (an earlier attempt landed), so continue from the offset the server reports.
      if (res.status === 409) return { nextOffset: await tusOffset(String(state.url)) };
      await expectOk(res, "Cloudflare Stream tus chunk");
      return { nextOffset: Number(res.headers.get("upload-offset") ?? offset + bytes.byteLength) };
    },
    async complete() {},
    async abort({ providerKey }) {
      await api(`/${providerKey}`, { method: "DELETE" });
    },
  },
};

function tusHeaders() {
  return {
    Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
    "Tus-Resumable": "1.0.0",
  };
}

async function tusOffset(url: string) {
  const res = await expectOk(
    await fetch(url, { method: "HEAD", headers: tusHeaders() }),
    "Cloudflare Stream tus status",
  );
  return Number(res.headers.get("upload-offset") ?? 0);
}
