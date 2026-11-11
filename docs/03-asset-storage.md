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
├── import.ts           server-side imports (Google Drive → provider), chunked + resumable
├── mime.ts             accepted MIME types per kind (client-safe)
├── image-meta.ts       sharp: width/height, blurDataUrl, dominantColor
└── util.ts             mime → kind, keys, size limits, HMAC helpers
app/api/media/local/[...key]   dev upload receiver (signed + expiring)
app/api/media/webhooks/[id]    provider webhooks (signature-verified)
app/api/media/import           runs an import in its own invocation (signed, self-chaining)
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
   - optional: `importer` (`begin` / `part` / `complete`, plus `offset` and `abort`) so it can receive server-side imports from Google Drive (see "Import sources")
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

## Import sources (Google Drive) and the Upload dialog

Ashyan's masters usually live in Google Drive, so the admin can add media from two places through one **Upload dialog** (`components/admin/upload/`), opened from Media → **Upload** and from every media picker ("Upload new"):

| Tab | How the bytes move |
|---|---|
| **This device** | Browser → provider directly (the pipeline above). |
| **Google Drive** | Google Picker → our server copies the file **server to server**, Drive → provider, in 16 MiB chunks. Nothing passes through the admin's browser, and the dialog can be closed while it runs. |

The queue under the tabs shows every item with its source, progress, status and a retry button. It belongs to the page rather than the dialog (`useUploadQueue`), so closing the dialog doesn't stop anything. The Media library shows imports as tiles with a progress bar (`Asset.status = UPLOADING` + an `AssetImport` row). On a phone the dialog is a full-screen sheet.

YouTube is out of scope (decided 2026-11-11).

### Connecting Google (link-only)

Google is a **linked service, never a way in** (`src/lib/auth.ts`):

- `disabledPaths: ["/sign-in/social", "/sign-in/oauth2"]` removes the only routes that could turn a Google identity into a session. The provider also has `disableSignUp` and `disableIdTokenSignIn`, and `accountLinking.disableImplicitLinking` is on.
- A signed-in admin links Google with `authClient.linkSocial({ provider: "google", scopes: [...] })` (`features/google/client.ts → connectGoogle`). This runs in a **popup** so unsaved work survives. Google's pages cut `window.opener`, so the landing page `/connected` reports back over a `BroadcastChannel`.
- `accessType: "offline"` + `prompt: "consent"` → Google always returns a refresh token. Tokens are stored **encrypted** (`account.encryptOAuthTokens`) in Better Auth's `account` table (no tables of our own). `auth.api.getAccessToken({ body: { accountId, userId } })` refreshes them.
- **One Google account, several features.** Each feature asks for its own scope (incremental consent); Better Auth merges the scopes when the same account is linked again. The granted scopes on the `account` row decide what works:

  | Feature | Scope | Google classification |
  |---|---|---|
  | Drive import | `https://www.googleapis.com/auth/drive.file` | non-sensitive: only files picked in the Picker |
  | Gmail notifications (#13) | `https://www.googleapis.com/auth/gmail.send` | sensitive (not restricted): send-only, can't read mail |

- `allowDifferentEmails` is on, so the Drive/Gmail account may differ from the admin login email. That's safe because a linked Google account can't sign in.
- **Disconnect** revokes the grant at `oauth2.googleapis.com/revoke` (all scopes at once) and deletes the link. Both Media → Upload → Google Drive and Settings → Connected services offer it.

### Drive import pipeline (`features/media/import.ts`)

1. **Choose from Drive** → `drivePickerAction()` returns a short-lived access token + the Picker API key + project number → the Google Picker (`apis.google.com/js/api.js`, loaded only on click). Files only, multi-select, My Drive + shared drives, filtered to the accepted MIME types (`features/media/mime.ts`). The Upload dialog hides itself while the Picker is up, because a modal dialog underneath would swallow its clicks.
2. `importFromDriveAction(fileIds)` (admin only) reads each file's metadata (`files.get?fields=name,mimeType,size,md5Checksum`) and applies the **same type/size rules** as device uploads (`validateUpload`). The kind's provider then starts a server upload session (`importer.begin`), and the action creates `Asset` (`UPLOADING`) + `AssetImport` (`RUNNING`).
3. `kickImport` POSTs to `/api/media/import` (HMAC-signed, 5-minute token, `maxDuration = 300`), which answers 202 and works in `after()`:
   - Each chunk: Drive `GET ?alt=media` with `Range` → `importer.part()` → save `bytesDone` + provider state. A failed chunk retries in place (3 tries, backoff).
   - After ~230 s the run stops taking new chunks and kicks a fresh invocation, so files of any size work.
   - A failed run is retried from the last saved chunk (up to 5 attempts). Permanent errors (Drive quota, permission, file gone, Google access revoked) fail at once with a readable message and a **Retry** button.
   - A 2-minute **lease** (`AssetImport.leaseUntil`, taken atomically) ensures one runner per file. If a function dies, the lease expires and the admin's progress polling (`importProgressAction`) kicks the import again.
4. Last chunk → `importer.complete()` → the normal `completeUpload()` → image analysis / Mux webhook / cache invalidation, exactly as for browser uploads.

Each provider owns its server-side write through the optional `StorageProvider.importer`:

| Provider | Protocol | Resume |
|---|---|---|
| `mux` | Direct Upload URL, `PUT` with `Content-Range` (the UpChunk protocol; 308 = continue) | `PUT bytes */total` → `Range` |
| `s3` (R2/S3/B2) | Multipart upload, one part per chunk | parts are idempotent by number |
| `vercel-blob` | `createMultipartUpload` / `uploadPart` / `completeMultipartUpload` | parts are idempotent by number |
| `cloudflare-stream` | tus (`POST` → `PATCH` at `Upload-Offset`) | `HEAD` → `Upload-Offset` |
| `local` (dev) | positional writes into `public/uploads` | idempotent |

`Asset.bytes` and `AssetImport.bytes*` are `BigInt`, since `Int` overflows at 2 GiB.

**Watch-outs:** `drive.file` covers the picked *files* only (picking a folder grants nothing, so folders can't be selected). Google-native Docs/Sheets/Slides have no binary content and are rejected. Very large or popular files can hit Drive's `downloadQuotaExceeded`, which shows as an error with Retry. On Vercel preview deployments with Deployment Protection, set `VERCEL_AUTOMATION_BYPASS_SECRET` so import runs can call their own route.

### Gmail notifications and confirmations (#13)

`features/google/gmail.ts` sends through the Gmail API (`users.me.messages.send`) from the linked mailbox. Messages are raw RFC 5322, multipart/alternative (text + HTML), with header-injection-safe headers and RFC 2047 subjects. After `submitContact` saves an enquiry, `after()` runs `notifyEnquiry` (`features/contact/notify.ts`). It sends two branded emails in the site's look (`features/contact/emails.ts`: AZ monogram, ink/onyx, serif headline with a red italic accent, mono labels, hairlines):

- **To us** ("New enquiry from *Priya Shah*"): every field, the received time, and **Reply** (mailto) and **Open inbox** buttons. From shows "Priya Shah via Ashyan Zafar"; Reply-To is the visitor.
- **To the visitor** ("Thank you, *Priya*."): a copy of what they sent, a note that we'll reply soon, and a link to the work. Reply-To is the public contact email.

Anyone can type someone else's address into the form, so the confirmation is guarded:

- the per-address limit (3 per 10 min);
- a site-wide cap of 100 confirmations per 24 h;
- echoed text clipped to 2,000 characters;
- links in the echo defanged with zero-width spaces, so our mailbox never delivers clickable spam.

Failures are logged and never affect the visitor, since the enquiry is already in Admin → Inbox. **Settings → Connected services → Send test email** sends both templates (with sample data) to the mailbox as a preview.

### Google Cloud Console setup (one-time, owner's Google account)

1. **Project**: create one (e.g. `ashyan-portfolio`) at console.cloud.google.com and note the **project number** (IAM & Admin → Settings).
2. **Enable APIs** (APIs & Services → Library): **Google Drive API**, **Google Picker API**, **Gmail API**.
3. **OAuth consent screen** (Google Auth Platform):
   - Branding: app name "Ashyan Zafar Admin", support email, the site domain under *Authorized domains*, privacy-policy and home-page URLs.
   - Audience: *External*.
   - Data access: `openid`, `email`, `profile`, `.../auth/drive.file` (non-sensitive) and `.../auth/gmail.send` (**sensitive**).
   - ⚠️ While the app is in **Testing**, refresh tokens expire after **7 days** and only listed test users can connect. Add the admin's Google account as a test user for local work, then **Publish app → In production** before launch so the connection doesn't drop every week.
   - Because `gmail.send` is sensitive, a production app that isn't verified shows Google's "unverified app" screen (Advanced → continue) and is capped at 100 users. That's fine for an admin-only app. To remove the screen, submit for verification (brand + scope justification + a short demo video; no security assessment, because the scope isn't *restricted*).
4. **OAuth client** (Credentials → Create credentials → OAuth client ID → *Web application*):
   - Authorized JavaScript origins: `http://localhost:3000`, `https://<prod domain>`.
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`, `https://<prod domain>/api/auth/callback/google`.
5. **API key for the Picker** (Credentials → API key): restrict it to the *Google Picker API* and to HTTP referrers `http://localhost:3000/*`, `https://<prod domain>/*` **and `https://docs.google.com/*`** (the Picker runs in an iframe there; without it you get "API developer key is invalid").
6. **Env** (`.env.local` and the Vercel project): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`, `NEXT_PUBLIC_GOOGLE_PROJECT_NUMBER`. All optional: when missing, the Drive tab and Settings say "not configured".
7. `pnpm media:check` prints a **Google** block: missing vars, a live check of the OAuth client, the key/project-number format, and which linked accounts grant Drive and Gmail.

## Delivery rules (how "instant" stays instant)

- **The poster is the LCP**, not the video. Preload it (`preload` on `next/image`), AVIF/WebP, sized with `sizes`.
- Hover/in-view loops: 3–6s, muted, `playsinline`, ≤ 720p, low bitrate (Mux static rendition or animated WebP). Load only when the card enters the viewport; play only on hover (desktop) or while visible (mobile); **one video playing at a time**.
- Full films: `preload="none"`, player code lazily imported on click, HLS adapts to bandwidth.
- Respect `Save-Data` and `prefers-reduced-motion` by showing the poster only.
- Captions (WebVTT) on every film. They help accessibility **and** SEO/GEO, since search engines read transcripts.
- Add each provider's CDN host to `images.remotePatterns` in `next.config.ts`.
