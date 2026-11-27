# 03 · Asset storage & delivery — Vercel Blob + YouTube

**Decision (2026-11-25, v2 / #24–#27):** every playable film or reel is a **YouTube link** behind a click-to-load facade; **Vercel Blob** holds everything else (stills, covers, gallery, logos, the portrait, and the 3–6 s muted hover loops). Mux, Cloudflare Stream and S3/R2 were removed, along with their webhooks and env vars. The adapters left are **`vercel-blob` (production)** and **`local` (development)**.

## Why YouTube for films

| | YouTube (facade) | What we gave up (Mux) |
|---|---|---|
| Cost | Free hosting, free adaptive streaming worldwide | Encoding + storage + delivery minutes |
| Page speed | **Zero YouTube bytes before a click** (poster + a real `<button>`); the iframe loads only on play | Mux Player was ~250 KB, also lazy |
| Analytics | PLAY / 25 / 50 / 75 / COMPLETE from the player's `postMessage` stream (no `iframe_api`), same events as before (docs/04) | Mux Data |
| SEO | VideoObject `embedUrl` + thumbnails, sitemap `player_loc`; the watch URL as `sameAs` | `contentUrl` to our own MP4 |

Trade-offs, stated in the admin's help text:

- YouTube branding stays in the player, and end screens can't be fully turned off (`rel=0` limits suggestions to the same channel).
- A video must be **public or unlisted, with embedding allowed**. Private videos don't play.
- Autoplay with sound needs the visitor's click, which the facade always has.
- If a CSP is ever added it needs `frame-src https://www.youtube-nocookie.com` and `img-src https://i.ytimg.com`.

### The film fields (`Project`, #24)

`filmUrl` (as entered: watch, youtu.be, `/shorts/`, `/embed/`, `/live/`), `filmYoutubeId` (parsed), `filmOrientation` (`LANDSCAPE | PORTRAIT | SQUARE`), `filmAspect` (optional exact width/height) and `filmDuration` (seconds, typed by the admin: oEmbed has no duration). `src/lib/youtube.ts` parses and validates links on both sides, and a `/shorts/` link pre-selects Portrait. **Orientation never comes from the thumbnail**: YouTube serves 16:9 thumbnails even for Shorts. The orientation picks the bento tile (#29) and the project page layout (#30).

### The player (`components/media/youtube-film.tsx`)

- Before a click: the project cover via `next/image` (`preload` + `fetchPriority="high"`, the page's LCP) and a `<button aria-label="Play film · 2:41: <title>">`. Hover/focus preconnects to `www.youtube-nocookie.com`, `i.ytimg.com` and `www.google.com`.
- On click: `https://www.youtube-nocookie.com/embed/<id>?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=<site>` with `title`, `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"` and `referrerpolicy="strict-origin-when-cross-origin"`. Focus moves into the iframe.
- Never auto-load the iframe on scroll: it pulls in about 1 MB of YouTube JS and wrecks INP.

## Hover loops on Blob (#26)

- Spec (shown in the admin): **3–6 s, muted, H.264 MP4 (or WebM), ≤ 720p (≤ 1280 px long edge), ~2–4 MB. Shoot reels' loops in 9:16.**
- Uploads chosen in a loop field carry `purpose: "loop"`: MP4/WebM only, capped by `MEDIA_MAX_LOOP_MB` (default 20). The Google Picker in a loop field only offers MP4/WebM. The form warns (never blocks) past 8 s, 8 MB or 1280 px.
- The browser reads `videoWidth`, `videoHeight` and `duration` from a metadata-only `<video>` while the file uploads, and `completeUploadAction` stores them (range-checked). Drive imports take the same values from Drive's `videoMediaMetadata`.
- `VideoLoop` (`{ src }`) plays one loop at a time, sets `src` within 200 px of the viewport, plays on hover/focus (desktop) or while ≥ 60 % in view (touch), and stays off for reduced motion and Save-Data. Portrait loops fill tall tiles with `object-cover`.
- Admin thumbnails for Blob videos are the file's own first frame (`<video preload="metadata" src="…#t=0.5">`).

## The storage module (`src/features/media`)

```
features/media/
├── types.ts            StorageProvider interface, UploadInstruction, ProviderResult
├── providers/
│   ├── index.ts        registry + routing (MEDIA_*_PROVIDER) + env checks
│   ├── local.ts        dev only: public/uploads via signed PUT URLs (zero setup)
│   └── vercel-blob.ts  Vercel Blob client uploads (scoped token) + multipart importer
├── service.ts          createUpload → completeUpload / ingest / deleteAsset
├── actions.ts          admin Server Actions (requireAdmin + cache invalidation)
├── client/upload.ts    uploadFile(file, { onProgress, purpose }) + probeVideo for the browser
├── probe.ts            range-checks width/height/duration hints (cleanProbe)
├── import.ts           server-side imports (Google Drive → Blob), chunked + resumable
├── mime.ts             accepted MIME types per kind (client-safe)
├── image-meta.ts       sharp: width/height, blurDataUrl, dominantColor
└── util.ts             mime → kind, keys, size limits (incl. loops), HMAC helpers
app/api/media/local/[...key]   dev upload receiver (signed + expiring)
app/api/media/import           runs an import in its own invocation (signed, self-chaining)
```

**Choosing providers is env-only.** Set `MEDIA_IMAGE_PROVIDER=vercel-blob` (and optionally `MEDIA_VIDEO_PROVIDER` / `MEDIA_FILE_PROVIDER`, which default to it) plus `BLOB_READ_WRITE_TOKEN`, then run:

```bash
pnpm media:check   # routing per media type, missing env, live Blob ping (list limit 1)
```

With nothing set, development uses `local` (no accounts needed). Production refuses to start uploads without a configured provider.

### Pipeline

1. `createUploadAction({ filename, mimeType, bytes, purpose? })` (admin only) validates type and size, picks the provider for that kind, mints a **direct-upload instruction**, and creates an `Asset` row (`UPLOADING`).
2. The browser sends the bytes **straight to the provider** (Vercel Blob token or a signed local PUT), with progress events. Nothing passes through our functions, so the 4.5 MB body limit doesn't apply.
3. `completeUploadAction(assetId, probe?)` asks the provider what happened. Everything comes back `READY`. Images get `width/height`, a 16px `blurDataUrl` and `dominantColor`; videos get the probed `width/height/duration`.
4. Cache tags `assets` and `projects` are invalidated.

`Asset.provider` is a plain string (the adapter id), so a future provider needs **no migration**.

### Adding a provider (≈ 1 file)

1. Create `src/features/media/providers/<name>.ts` exporting a `StorageProvider`: `id`, `label`, `kinds`, `requiredEnv`, `setup`, `createUpload`, `finalize`, `delete`, and optionally `read`, `check` and `importer` (`begin` / `part` / `complete`, plus `offset` and `abort`) for Google Drive imports.
2. Add it to `providers/index.ts` and to the `mediaProvider` enum in `src/lib/env.ts`.
3. Add its env block to `.env.example`, and its CDN host to `images.remotePatterns` in `next.config.ts`.
4. `pnpm media:check`, then upload a test file from the admin.

**Vercel Blob notes:** a public store; client tokens are scoped to one pathname, content type and size for 15 minutes; keys are unique per upload, so files are cached for a year.

### Moving off Mux (one-off, #27)

- `pnpm media:loops-to-blob [--yes]` copies any project's hover loop still on Mux to Blob (with ffprobe dimensions) and repoints the project.
- `pnpm seed:media <clips-dir>` fills in the demo projects' YouTube films, labels and Blob loops.
- `pnpm media:mux-teardown [--yes]` lists every Mux asset next to its `Asset` row, refuses while a published project lacks a YouTube film or still loops from Mux, and with `--yes` deletes the assets at Mux and the rows. **Run it only after the v2 release is live**, then delete the Mux webhook in the Mux dashboard and the `MUX_*` vars in Vercel, then apply the `drop_mux_fields` migration (`pnpm db:deploy`).

## Import sources (Google Drive) and the Upload dialog

Ashyan's masters usually live in Google Drive, so the admin can add media from two places through one **Upload dialog** (`components/admin/upload/`), opened from Media → **Upload** and from every media picker ("Upload new"):

| Tab | How the bytes move |
|---|---|
| **This device** | Browser → provider directly (the pipeline above). |
| **Google Drive** | Google Picker → our server copies the file **server to server**, Drive → provider, in 16 MiB chunks. Nothing passes through the admin's browser, and the dialog can be closed while it runs. |

The queue under the tabs shows every item with its source, progress, status and a retry button. It belongs to the page rather than the dialog (`useUploadQueue`), so closing the dialog doesn't stop anything. The Media library shows imports as tiles with a progress bar (`Asset.status = UPLOADING` + an `AssetImport` row). On a phone the dialog is a full-screen sheet.

Imports land in Vercel Blob (images and hover loops). Films are not uploaded at all: they are YouTube links.

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
2. `importFromDriveAction(fileIds, purpose?)` (admin only) reads each file's metadata (`files.get?fields=name,mimeType,size,md5Checksum,videoMediaMetadata`) and applies the **same type/size rules** as device uploads (`validateUpload`). The kind's provider then starts a server upload session (`importer.begin`), and the action creates `Asset` (`UPLOADING`) + `AssetImport` (`RUNNING`).
3. `kickImport` POSTs to `/api/media/import` (HMAC-signed, 5-minute token, `maxDuration = 300`), which answers 202 and works in `after()`:
   - Each chunk: Drive `GET ?alt=media` with `Range` → `importer.part()` → save `bytesDone` + provider state. A failed chunk retries in place (3 tries, backoff).
   - After ~230 s the run stops taking new chunks and kicks a fresh invocation, so files of any size work.
   - A failed run is retried from the last saved chunk (up to 5 attempts). Permanent errors (Drive quota, permission, file gone, Google access revoked) fail at once with a readable message and a **Retry** button.
   - A 2-minute **lease** (`AssetImport.leaseUntil`, taken atomically) ensures one runner per file. If a function dies, the lease expires and the admin's progress polling (`importProgressAction`) kicks the import again.
4. Last chunk → `importer.complete()` → the normal `completeUpload()` → image analysis / cache invalidation, exactly as for browser uploads. Videos already carry Drive's `videoMediaMetadata` size and runtime.

Each provider owns its server-side write through the optional `StorageProvider.importer`:

| Provider | Protocol | Resume |
|---|---|---|
| `vercel-blob` | `createMultipartUpload` / `uploadPart` / `completeMultipartUpload` | parts are idempotent by number |
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
- Hover/in-view loops: 3–6 s, muted, `playsinline`, ≤ 720p, ~2–4 MB, from Blob. Load only when the card nears the viewport; play only on hover (desktop) or while visible (mobile); **one video playing at a time**. Blob bandwidth is billed per GB, so keep them small (docs/07).
- Films: nothing from YouTube until the visitor presses play; then the nocookie embed.
- Respect `Save-Data` and `prefers-reduced-motion` by showing the poster only.
- Film transcripts go in the project's Transcript field (shown on the page and used as `VideoObject.transcript`); captions live on YouTube.
- `images.remotePatterns`: `*.public.blob.vercel-storage.com` and `i.ytimg.com` (admin previews).
