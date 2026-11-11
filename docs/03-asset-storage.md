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

## Upload & processing pipeline (provider-agnostic)

1. Admin drops a file into the Media library.
2. A server action (behind `requireAdmin`) asks the provider for a **signed direct-upload URL** and creates an `Asset` row with `status=UPLOADING`.
3. The browser uploads straight to the provider, with resumable chunks for large video.
4. Images: on completion, the server generates `width/height`, a 16px **`blurDataUrl`** and the **`dominantColor`** (sharp). These give instant placeholders and zero layout shift.
5. Video: the Mux webhook `video.asset.ready` sets `status=READY`, `playbackId` and `duration`.
6. `updateTag("assets")` plus any affected `project:*` tags.

`features/media/` exposes one interface (`createUpload`, `finalize`, `delete`, `urlFor`), and each provider implements it. `Asset.provider` records where each file lives, so providers can be switched or mixed later.

## Delivery rules (how "instant" stays instant)

- **The poster is the LCP**, not the video. Preload it (`preload` on `next/image`), AVIF/WebP, sized with `sizes`.
- Hover/in-view loops: 3–6s, muted, `playsinline`, ≤ 720p, low bitrate (Mux static rendition or animated WebP). Load only when the card enters the viewport; play only on hover (desktop) or while visible (mobile); **one video playing at a time**.
- Full films: `preload="none"`, player code lazily imported on click, HLS adapts to bandwidth.
- Respect `Save-Data` and `prefers-reduced-motion` by showing the poster only.
- Captions (WebVTT) on every film. They help accessibility **and** SEO/GEO, since search engines read transcripts.
- Add each provider's CDN host to `images.remotePatterns` in `next.config.ts`.
