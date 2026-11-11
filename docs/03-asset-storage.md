# 03 · Asset storage & delivery — options

Goal: films start fast and adapt to the viewer's connection, images are tiny and sharp, and the admin can upload multi-GB masters straight from the browser. Vercel Functions cap request bodies at **4.5 MB**, so every upload must go **directly from the browser to the provider** using a signed URL.

## Video (the core of this site)

| Option | Why | Watch-outs | Cost profile |
|---|---|---|---|
| **Mux Video** ⭐ recommended | Adaptive HLS with per-title encoding. Direct browser uploads. Instant thumbnails, animated WebP/GIF previews and storyboards from `image.mux.com` (ideal for posters and hover loops). Static MP4 renditions for short loops. **Mux Data** gives plays, watch time and rebuffering, which feed our analytics. `<mux-player>` handles captions and quality switching. Webhooks report when an asset is ready. | Usage-based pricing (encoding + storage + delivery minutes) | Best quality per byte; moderate cost |
| **Cloudflare Stream** | HLS/DASH, direct creator uploads, simple flat pricing, global network | Player and analytics are more basic; fewer image-transform tricks | Cheap and predictable |
| **Bunny Stream** | Cheapest, good CDN, built-in player and HLS, storage + delivery bundled | Smaller ecosystem; webhooks and APIs less polished | Lowest |
| Vimeo / YouTube embed | Free hosting | Heavy iframes hurt LCP and INP, branding, no control over loading. **Avoid for the main site** (fine as `sameAs` links for SEO) | Free |

## Images, logos, PDFs

| Option | Why | Watch-outs |
|---|---|---|
| **Vercel Blob** ⭐ if hosting on Vercel | Zero setup on Vercel, public and private stores, client direct uploads, works with `next/image` (AVIF/WebP, responsive `srcset`) | Bandwidth billed on Vercel |
| **Cloudflare R2** | S3-compatible, **zero egress fees**, cheap at scale | Needs a custom domain for public access; slightly more wiring |
| **Cloudinary** | One service for image and video transforms, auto-format | Costs climb with bandwidth; another vendor |

## Recommended combination

**Mux for all video, plus Vercel Blob for images and documents** (or R2 if cost or hosting off Vercel matters more).

Costs for a 200 GB library are worked out in [docs/07-storage-costs.md](07-storage-costs.md).

## The storage module (`src/features/media`), built and provider-agnostic

```
features/media/
├── types.ts            StorageProvider interface, UploadInstruction, ProviderResult
├── providers/
│   ├── index.ts        registry + routing (MEDIA_*_PROVIDER) + env checks
│   ├── local.ts        dev only: public/uploads via signed PUT URLs (zero setup)
│   ├── s3.ts           any S3-compatible store: Cloudflare R2, AWS S3, Backblaze B2, MinIO
│   ├── vercel-blob.ts  Vercel Blob client uploads (scoped token)
│   ├── mux.ts          Mux Direct Uploads + webhook
│   └── cloudflare-stream.ts  Direct Creator Uploads + webhook
├── service.ts          createUpload → completeUpload → applyWebhook / deleteAsset
├── actions.ts          admin Server Actions (requireAdmin + cache invalidation)
├── client/upload.ts    uploadFile(file, { onProgress }) for the browser
├── image-meta.ts       sharp: width/height, blurDataUrl, dominantColor
└── util.ts             mime → kind, keys, size limits, HMAC helpers
app/api/media/local/[...key]   dev upload receiver (signed + expiring)
app/api/media/webhooks/[id]    provider webhooks (signature-verified)
```

**Choosing providers is env-only.** Set `MEDIA_VIDEO_PROVIDER`, `MEDIA_IMAGE_PROVIDER` and optionally `MEDIA_FILE_PROVIDER` (PDF/audio, defaults to the image provider), fill that provider's block in `.env.local`, then run:

```bash
pnpm media:check   # routing per media type, missing env per provider, live credential check
```

With nothing set, development uses `local` (no accounts needed). Production refuses to start uploads without a configured provider.

### Pipeline

1. `createUploadAction({ filename, mimeType, bytes })` (admin only) validates type and size, picks the provider for that kind, mints a **direct-upload instruction**, and creates an `Asset` row (`UPLOADING`).
2. The browser sends the bytes **straight to the provider** (`client/upload.ts`: presigned PUT, form POST, or Vercel Blob token), with progress events. Nothing passes through our functions, so the 4.5 MB body limit doesn't apply.
3. `completeUploadAction(assetId)` asks the provider what happened. Images become `READY` with `width/height`, a 16px `blurDataUrl` and `dominantColor`. Streaming video usually comes back `PROCESSING`.
4. The provider webhook (`/api/media/webhooks/mux` or `/cloudflare-stream`) is HMAC-verified (5-minute replay window) and sets `READY` with `playbackId`, `duration`, poster `url`, and `meta.hls` / `meta.animated`.
5. Cache tags `assets` and `projects` are invalidated.

`Asset.provider` is a plain string (the adapter id), so providers can be mixed (Mux for video, R2 for stills) and new ones need **no migration**.

### Adding a provider (≈ 1 file)

1. Create `src/features/media/providers/<name>.ts` exporting a `StorageProvider`:
   - `id`, `label`, `kinds`, `requiredEnv`, `setup` (shown by `media:check` when env is missing)
   - `createUpload({ key, mimeType, bytes, kind })` returns `{ providerKey, upload }`, using one of the `UploadInstruction` strategies (add a new strategy to `client/upload.ts` only if the provider needs one, e.g. tus)
   - `finalize(providerKey)` returns `ProviderResult`; `delete(providerKey)`
   - optional: `read` (image analysis), `webhook` (verify + parse), `check` (credential ping)
2. Add it to the list in `providers/index.ts` and to the `mediaProvider` enum in `src/lib/env.ts`.
3. Add its env block to `.env.example`, and its CDN host to `images.remotePatterns` in `next.config.ts`.
4. `pnpm media:check`, then upload a test file from the admin.

Candidates already sketched in docs/07: Bunny Stream (tus uploads with signed headers) and Cloudinary (signed upload preset).

### Provider setup notes

- **S3 / R2**: the bucket needs CORS so browsers can PUT. R2 example:
  ```json
  [{ "AllowedOrigins": ["https://ashyanzafar.com", "http://localhost:3000"],
     "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
  ```
  Serve files from a custom domain (`S3_PUBLIC_URL`), not `r2.dev`, in production.
- **Mux**: webhook URL `<site>/api/media/webhooks/mux`; `MUX_VIDEO_QUALITY=basic` keeps encoding free (docs/07). Direct uploads PUT the whole file; switch to Mux UpChunk if masters exceed a few GB.
- **Cloudflare Stream**: Direct Creator Uploads accept files up to 200 MB; larger needs a tus strategy.
- **Vercel Blob**: public store; tokens are scoped to one pathname, content type and size for 15 minutes.

## Delivery rules (how "instant" stays instant)

- **The poster is the LCP**, not the video. Preload it (`preload` on `next/image`), AVIF/WebP, sized with `sizes`.
- Hover/in-view loops: 3–6s, muted, `playsinline`, ≤ 720p, low bitrate (Mux static rendition or animated WebP). Load only when the card enters the viewport; play only on hover (desktop) or while visible (mobile); **one video playing at a time**.
- Full films: `preload="none"`, player code lazily imported on click, HLS adapts to bandwidth.
- Respect `Save-Data` and `prefers-reduced-motion` by showing the poster only.
- Captions (WebVTT) on every film. They help accessibility **and** SEO/GEO, since search engines read transcripts.
- Add each provider's CDN host to `images.remotePatterns` in `next.config.ts`.
