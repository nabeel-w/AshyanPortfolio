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
  return {
    endpoint,
    bucket,
    objectUrl,
    client,
    publicBase: process.env.S3_PUBLIC_URL!.replace(/\/$/, ""),
  };
}

export const s3: StorageProvider = {
  id: "s3",
  label: "S3-compatible (R2 / S3 / B2 / MinIO)",
  kinds: ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"],
  requiredEnv: [
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_PUBLIC_URL",
  ],
  optionalEnv: ["S3_REGION", "S3_FORCE_PATH_STYLE"],
  setup:
    "Create a bucket + API token with read/write on it, add a CORS rule for PUT from your site, then set S3_* (R2: https://developers.cloudflare.com/r2/api/s3/tokens/).",

  async createUpload({ key }) {
    const { client, objectUrl } = cfg();
    const url = new URL(objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(PRESIGN_TTL_SECONDS));
    const signed = await client.sign(new Request(url, { method: "PUT" }), {
      aws: { signQuery: true },
    });
    return { providerKey: key, upload: { strategy: "put", url: signed.url } };
  },

  async finalize(key) {
    const { client, objectUrl, publicBase } = cfg();
    const res = await client.fetch(objectUrl(key), { method: "HEAD" });
    if (!res.ok) return { status: "ERRORED", meta: { error: `HEAD ${res.status}` } };
    const url = `${publicBase}/${key}`;
    return {
      status: "READY",
      url,
      bytes: Number(res.headers.get("content-length")) || undefined,
      meta: { mp4: url },
    };
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

  // Server imports use S3 multipart: one part per chunk (all parts the same size except the last,
  // which R2 requires). Re-sending a part number simply replaces it, so retries are safe.
  importer: {
    async begin({ key, mimeType }) {
      const { client, objectUrl } = cfg();
      const res = await expectOk(
        await client.fetch(`${objectUrl(key)}?uploads`, {
          method: "POST",
          headers: { "Content-Type": mimeType },
        }),
        "S3 create multipart upload",
      );
      const uploadId = (await res.text()).match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
      if (!uploadId) throw new Error("S3 create multipart upload: no UploadId in response");
      return { providerKey: key, state: { uploadId, parts: [] } };
    },
    async part({ providerKey, state, partNumber }, bytes) {
      const { client, objectUrl } = cfg();
      const url = `${objectUrl(providerKey)}?partNumber=${partNumber}&uploadId=${encodeURIComponent(String(state.uploadId))}`;
      const res = await expectOk(
        await client.fetch(url, { method: "PUT", body: bytes }),
        `S3 upload part ${partNumber}`,
      );
      const etag = res.headers.get("etag");
      if (!etag)
        throw new Error(
          `S3 upload part ${partNumber}: no ETag (expose it in the bucket CORS/ACL?)`,
        );
      return { state: { ...state, parts: upsertPart(state.parts, { partNumber, etag }) } };
    },
    async complete({ providerKey, state }) {
      const { client, objectUrl } = cfg();
      const parts = [...(state.parts as Part[])].sort((a, b) => a.partNumber - b.partNumber);
      const xml = `<CompleteMultipartUpload>${parts
        .map(
          (p) =>
            `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${escapeXml(p.etag)}</ETag></Part>`,
        )
        .join("")}</CompleteMultipartUpload>`;
      const url = `${objectUrl(providerKey)}?uploadId=${encodeURIComponent(String(state.uploadId))}`;
      const res = await expectOk(
        await client.fetch(url, { method: "POST", body: xml }),
        "S3 complete multipart upload",
      );
      // S3 can answer 200 with an <Error> body when completion fails late.
      const text = await res.text();
      if (/<Error>/.test(text))
        throw new Error(`S3 complete multipart upload failed: ${text.slice(0, 300)}`);
    },
    async abort({ providerKey, state }) {
      const { client, objectUrl } = cfg();
      if (!state.uploadId) return;
      await client.fetch(
        `${objectUrl(providerKey)}?uploadId=${encodeURIComponent(String(state.uploadId))}`,
        { method: "DELETE" },
      );
    },
  },
};

type Part = { partNumber: number; etag: string };

/** Replace (or add) a part's etag; retries of the same part number overwrite it. */
export function upsertPart(parts: unknown, part: Part): Part[] {
  return [
    ...((parts as Part[] | undefined) ?? []).filter((p) => p.partNumber !== part.partNumber),
    part,
  ];
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
