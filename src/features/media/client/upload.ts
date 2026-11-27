"use client";

import { completeUploadAction, createUploadAction } from "../actions";
import type { MediaProbe } from "../probe";
import type { UploadInstruction } from "../types";

/**
 * Upload one file from the browser, whatever the provider:
 *   const asset = await uploadFile(file, { onProgress: (p) => setProgress(p) })
 * Bytes go straight from the browser to the provider; our server only signs and records.
 */
export async function uploadFile(
  file: File,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal; purpose?: "loop" } = {},
) {
  const ticket = await createUploadAction({
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes: file.size,
    ...(opts.purpose ? { purpose: opts.purpose } : {}),
  });
  // Read the video's shape while it uploads: Blob stores no width/height/duration for videos (#24).
  const probe = file.type.startsWith("video/") ? probeVideo(file) : Promise.resolve(undefined);
  await send(ticket.upload, file, opts);
  opts.onProgress?.(1);
  const meta = await probe;
  return meta ? completeUploadAction(ticket.assetId, meta) : completeUploadAction(ticket.assetId);
}

/**
 * Width, height and duration of a local video file, from a metadata-only <video> on an object URL.
 * Resolves undefined when the browser can't decode it (the upload still goes through).
 */
export function probeVideo(file: Blob, timeoutMs = 8000): Promise<MediaProbe | undefined> {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return resolve(undefined);
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const done = (value: MediaProbe | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load?.();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => done(undefined), timeoutMs);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () =>
      done(
        video.videoWidth && video.videoHeight
          ? {
              width: video.videoWidth,
              height: video.videoHeight,
              duration: Number.isFinite(video.duration) ? video.duration : undefined,
            }
          : undefined,
      );
    video.onerror = () => done(undefined);
    video.src = url;
  });
}

async function send(upload: UploadInstruction, file: File, opts: { onProgress?: (f: number) => void; signal?: AbortSignal }) {
  switch (upload.strategy) {
    case "put":
      return xhr("PUT", upload.url, file, { "Content-Type": file.type, ...upload.headers }, opts);
    case "form-post": {
      const form = new FormData();
      form.append(upload.fieldName, file);
      return xhr("POST", upload.url, form, {}, opts);
    }
    case "vercel-blob": {
      const { put } = await import("@vercel/blob/client");
      await put(upload.pathname, file, {
        access: "public",
        token: upload.token,
        contentType: upload.contentType,
        multipart: file.size > 100 * 1024 * 1024,
        abortSignal: opts.signal,
        onUploadProgress: (e) => opts.onProgress?.(e.percentage / 100),
      });
      return;
    }
  }
}

/** XHR instead of fetch: fetch still can't report upload progress in every browser. */
function xhr(
  method: string,
  url: string,
  body: XMLHttpRequestBodyInit,
  headers: Record<string, string>,
  { onProgress, signal }: { onProgress?: (f: number) => void; signal?: AbortSignal },
) {
  return new Promise<void>((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open(method, url);
    for (const [k, v] of Object.entries(headers)) if (v) req.setRequestHeader(k, v);
    req.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    req.onload = () => (req.status < 300 ? resolve() : reject(new Error(`Upload failed (${req.status})`)));
    req.onerror = () => reject(new Error("Upload failed (network)"));
    req.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));
    signal?.addEventListener("abort", () => req.abort(), { once: true });
    req.send(body);
  });
}
