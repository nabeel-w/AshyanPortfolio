"use client";

import { completeUploadAction, createUploadAction } from "../actions";
import type { UploadInstruction } from "../types";

/**
 * Upload one file from the browser, whatever the provider:
 *   const asset = await uploadFile(file, { onProgress: (p) => setProgress(p) })
 * Bytes go straight from the browser to the provider; our server only signs and records.
 */
export async function uploadFile(file: File, opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}) {
  const ticket = await createUploadAction({
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes: file.size,
  });
  await send(ticket.upload, file, opts);
  opts.onProgress?.(1);
  return completeUploadAction(ticket.assetId);
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
