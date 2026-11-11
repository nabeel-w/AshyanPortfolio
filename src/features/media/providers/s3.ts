import { AwsClient } from "aws4fetch";
import type { StorageProvider } from "../types";
import { expectOk } from "../util";

/**
 * Any S3-compatible object store via presigned URLs: Cloudflare R2, AWS S3, Backblaze B2, Wasabi, MinIO…
 *
 *   Cloudflare R2  S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com   S3_REGION=auto
 *   AWS S3         S3_ENDPOINT=https://s3.<region>.amazonaws.com               S3_REGION=<region>
 *   Backblaze B2   S3_ENDPOINT=https://s3.<region>.backblazeb2.com             S3_REGION=<region>
 *
 * S3_PUBLIC_URL is the public/CDN base the files are served from (R2 custom domain, CloudFront, etc).
 * The bucket needs a CORS rule allowing PUT from the site origin (docs/03-asset-storage.md).
 * Video is stored as a plain file (progressive MP4) — use a streaming provider for adaptive playback.
 */
const PRESIGN_TTL_SECONDS = 15 * 60;

function cfg() {
  const endpoint = process.env.S3_ENDPOINT!.replace(/\/$/, "");
  const bucket = process.env.S3_BUCKET!;
  const pathStyle = process.env.S3_FORCE_PATH_STYLE !== "false";
  const objectUrl = (key: string) => {
    const k = key.split("/").map(encodeURIComponent).join("/");
    if (pathStyle) return `${endpoint}/${bucket}/${k}`;
    const u = new URL(endpoint);
    return `${u.protocol}//${bucket}.${u.host}/${k}`;
  };
  const client = new AwsClient({
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    service: "s3",
    region: process.env.S3_REGION || "auto",
  });
  return { endpoint, bucket, objectUrl, client, publicBase: process.env.S3_PUBLIC_URL!.replace(/\/$/, "") };
}

export const s3: StorageProvider = {
  id: "s3",
  label: "S3-compatible (R2 / S3 / B2 / MinIO)",
  kinds: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"],
  requiredEnv: ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_URL"],
  optionalEnv: ["S3_REGION", "S3_FORCE_PATH_STYLE"],
  setup:
    "Create a bucket + API token with read/write on it, add a CORS rule for PUT from your site, then set S3_* (R2: https://developers.cloudflare.com/r2/api/s3/tokens/).",

  async createUpload({ key }) {
    const { client, objectUrl } = cfg();
    const url = new URL(objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(PRESIGN_TTL_SECONDS));
    const signed = await client.sign(new Request(url, { method: "PUT" }), { aws: { signQuery: true } });
    return { providerKey: key, upload: { strategy: "put", url: signed.url } };
  },

  async finalize(key) {
    const { client, objectUrl, publicBase } = cfg();
    const res = await client.fetch(objectUrl(key), { method: "HEAD" });
    if (!res.ok) return { status: "ERRORED", meta: { error: `HEAD ${res.status}` } };
    const url = `${publicBase}/${key}`;
    return { status: "READY", url, bytes: Number(res.headers.get("content-length")) || undefined, meta: { mp4: url } };
  },

  async delete(key) {
    const { client, objectUrl } = cfg();
    const res = await client.fetch(objectUrl(key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) await expectOk(res, "S3 delete");
  },

  async read(key) {
    const { client, objectUrl } = cfg();
    const res = await expectOk(await client.fetch(objectUrl(key)), "S3 get");
    return Buffer.from(await res.arrayBuffer());
  },

  async check() {
    const { client, endpoint, bucket } = cfg();
    const res = await client.fetch(`${endpoint}/${bucket}?list-type=2&max-keys=1`);
    await expectOk(res, "S3 list");
    return `bucket "${bucket}" reachable`;
  },
};
