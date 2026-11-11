<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ashyan Zafar — portfolio · project memory

Portfolio + admin CMS for **Ashyan Zafar, film editor**. The selling point is the UI: luxury, cinematic, **black · white · red**, instant loads, best-in-class SEO/GEO, and a mobile layout designed on purpose (not just shrunk).
Repo: `github.com/nabeel-w/AshyanPortfolio` (branch `main`). Push as gh account **nabeel-w**. The machine's default active gh account is `nabeel-uprez`, and gh's credential helper only uses the active account, so run `gh auth switch -h github.com -u nabeel-w` before `git push` / `gh` commands and switch back afterwards. Pass `-R nabeel-w/AshyanPortfolio` to gh. Work is tracked in GitHub issues #1–#21 (labels `phase-1`…`phase-6`, `area:*`, `decision`); see docs/06.

Plans live in `docs/`: 01 design direction · 02 architecture/folders/editor · 03 asset storage · 04 analytics dashboard · 05 SEO/GEO · 06 roadmap + open questions. **Read them before building a feature.**

## Commands (pnpm only — never npm/yarn)

```
pnpm dev            # http://localhost:3000
pnpm build          # prisma generate && next build
pnpm lint | pnpm typecheck | pnpm format
pnpm db:migrate     # prisma migrate dev (direct connection, see below)
pnpm db:deploy      # apply committed migrations (prod/CI)
pnpm db:seed        # tsx prisma/seed.ts: site settings + home sections (idempotent)
pnpm admin:create <email> "<Name>"   # create/reset an admin; hidden password prompt or ADMIN_PASSWORD env
pnpm media:check    # storage routing, missing env per provider, live credential ping
pnpm test           # Vitest: unit (node) + components (jsdom) · test:watch · test:unit · test:components · test:coverage
pnpm exec next typegen   # regenerate route types (LayoutProps/PageProps) after deleting .next
```

## Stack facts & gotchas (verified 2026-11-11)

- **Next 16.4.6** with `cacheComponents: true` and `partialPrefetching: true` on by default. Consequences:
  - Anything reading cookies/headers (the session) must sit under `<Suspense>`; see `app/admin/layout.tsx` (Guard pattern).
  - No `new Date()` / `Math.random()` in prerendered server code (the footer year is `site.copyrightYear`).
  - `export const dynamic = "force-static"` and similar segment configs are **not** used. Caching is `"use cache"` + `cacheTag` + `cacheLife`; invalidate with `updateTag` (read-your-writes in server actions) or `revalidateTag(tag, "max")`.
  - Middleware is now **`src/proxy.ts`** (export `proxy`).
  - `<Image priority>` is deprecated, so use **`preload`** (+ `fetchPriority="high"`) for the LCP image. `images.qualities` is required; ours is `[60, 75, 90]`.
  - `LayoutProps<"/route">` / `PageProps` are global generated types (`next typegen`).
- **Tailwind v4** runs through the `@tailwindcss/turbopack` loader (set in `next.config.ts`). There's no tailwind.config; tokens live in `src/app/globals.css` under `@theme inline`. Editor CSS lint warnings about `@theme`/`@apply` are harmless.
- **shadcn** style `base-nova` uses **Base UI** primitives (`@base-ui/react`), not Radix. `cn` is imported from the **`cn` package** (`src/lib/utils.ts` re-exports it). Add components with `pnpm dlx shadcn@latest add <name>`. The generated `hooks/use-mobile.ts` was rewritten to `useSyncExternalStore` to pass the React-hooks lint rule.
- **Prisma pinned to 7.10.1** (`prisma`, `@prisma/client`, `@prisma/adapter-neon`). On npm, `latest` currently points to **8.0.0-rc**, so never bare-install `prisma`. Generator `prisma-client` outputs to `src/generated/prisma` (gitignored; `postinstall` regenerates it). Import from `@/generated/prisma/client`. The CLI config is `prisma.config.ts` (`prisma init` names it `prisma7.config.ts`; we renamed it). The runtime uses the pooled `DATABASE_URL` through `PrismaNeon`. **Migrations need the direct host**, so `prisma.config.ts` takes `DIRECT_URL` (or `DATABASE_URL`) and strips `-pooler.` automatically. A pooler URL pasted into `DIRECT_URL` is therefore harmless. `prisma.config.ts`, `prisma/seed.ts` and `scripts/*` load **`.env.local` then `.env`** with dotenv, matching Next, so a separate `.env` isn't needed.
- DB state (2026-11-11): Neon project in ap-southeast-1, database `neondb`. Migration `init` applied and seeded. No admin user yet; the owner runs `pnpm admin:create` with an email from `ADMIN_EMAILS`.
- **pnpm 11** blocks install scripts unless whitelisted in `pnpm-workspace.yaml` → `allowBuilds` (prisma, @prisma/engines, sharp, esbuild, unrs-resolver). Add new native deps there.
- **Better Auth 1.7**: `src/lib/auth.ts` (server, `server-only`), `src/lib/auth-client.ts`, handler `app/api/auth/[...all]`. Sign-up is restricted to `ADMIN_EMAILS` by a `databaseHooks.user.create.before` hook. `requireAdmin()` (`src/lib/session.ts`) is the real gate; proxy is optimistic only.
- `src/lib/env.ts` validates env with zod at import. **Any server module importing db/auth needs a valid `.env.local`.** `.env.local` holds local placeholders; `.env.example` is the committed template (gitignore has `!.env.example`).
- Seed and scripts run with **tsx** (Node type-stripping can't resolve the generated client's imports).

## Architecture conventions

- Route groups: `(site)` is public, static and cached; `(auth)/login`; `admin/*` is private (noindex).
- **Section system** = the editor's core: `src/features/sections/schemas.ts` (one zod schema per section type) + `registry.tsx` (type → component + `SectionRenderer`). To add a section: schema, then component in `components/site`, then registry entry. DB `Section.data` is the draft and `publishedData` is live.
- **Content layer** (`src/features/content/`): `queries.ts` holds `getSite`, `getPublishedPage(slug)`, `getPublishedProjects`, `getWorkList`, all `"use cache"` + `cacheTag` + `cacheLife("max")`. `tags.ts` holds the tag names. `invalidate.ts` has `updateTag` helpers that **every admin mutation must call**. Pages read `Section.publishedData`, validated by the zod schemas (invalid sections are skipped with a warning). The work grid and client marquee are hydrated from the `Project`/`Client` tables once they have rows. An empty DB falls back to `src/content/fallback.ts`. DB errors are not swallowed.
- **Media / storage** (`src/features/media/`, docs/03): provider-agnostic `StorageProvider` adapters (`local` for dev only, `s3` for R2/S3/B2/MinIO, `vercel-blob`, `mux`, `cloudflare-stream`), routed per media kind by `MEDIA_VIDEO_PROVIDER` / `MEDIA_IMAGE_PROVIDER` / `MEDIA_FILE_PROVIDER` (empty means unset; dev falls back to `local`). Browsers upload **directly** to the provider (signed PUT / form POST / Blob token). `service.ts` is the pipeline, `actions.ts` the admin entry points, and `client/upload.ts` gives `uploadFile(file, {onProgress})`. Webhooks at `/api/media/webhooks/<id>` are HMAC-verified with a 5-minute replay window. `Asset.provider` is a **string** (migration `asset_provider_string` cast the old enum in place), so new providers need no migration. Adding one = 1 adapter file + registry + env enum + `.env.example` + `remotePatterns`. Costs for 200 GB are in docs/07.
- Scripts that import `server-only` modules run as `tsx --conditions=react-server …`. Wrap top-level await in `main()` (tsx compiles `.ts` scripts to CJS), and on Windows use `pathToFileURL` for absolute dynamic imports.
- Testing auth with curl: Better Auth rejects requests whose `Origin` isn't `BETTER_AUTH_URL` (`INVALID_ORIGIN`), so send `-H "Origin: http://localhost:3000"` even when the server runs on another port.
- Headline micro-markup: `*italic red serif*`, `**SANS CAPS**` (rendered by `components/site/rich-text.tsx`). Never store HTML.
- Server Components by default. Client islands only: `blade-cursor`, `timecode`, `mobile-menu`, `login-form`. Keep home-page JS ≤ 40 KB gz.
- Section tones: `tone="ink"` (default) or `"paper"`. The `.tone-paper` class flips the semantic tokens.

## Design system (details in docs/01)

- Colours: ink `#0A0A0A`, onyx `#111`, graphite `#1C1C1C`, ivory `#F4F1EC` (text), paper background `#F6F5F2`, smoke `#8C8984`, **cinema red `#C1121F`** (hover `#E3202D`), oxblood `#5C0A10`. Red covers under 5% of any screen. Sharp corners, hairlines (`border-hairline`).
- Fonts (`next/font/google`): **Instrument Serif** (display, italic accents) → `font-serif`; **Geist** (body) → `font-sans`; **JetBrains Mono** (labels/timecode) → `font-mono`, `.label` utility.
- Type scale: `text-display` / `text-headline` / `text-title` are fluid `clamp()` tokens.
- Motifs: REC dot + running SMPTE timecode, numbered nav `01 WORK`, red playhead sweep on card hover, blade cursor (scalpel tilts with velocity, red slash on click, PLAY ring over `[data-cursor="play"]`), `link-cut` underline wipe.

## Client reference findings (browsed 2026-11-11)

| Client said | Site | Finding |
|---|---|---|
| "Nick Clement — rotating client logos" | nickclement.com | Framer ticker: dark rounded tiles (~130×90) with white mono logos, slow continuous drift, faded edges. Font BDO Grotesk. |
| "Taha Seder — fonts" | tahaseder.com | Instrument Serif 400 (h1 176px, −0.035em tracking, *italic* accent word in orange), JetBrains Mono labels (11–12px, uppercase, ~0.15em tracking), Geist body. Header has `● TAHA · SEDER`, a London clock, `01 WORK 02 REEL…`. |
| "Drive image — something interesting" | `assets/Cinematic Film Editor Portfolio.png` | An AI moodboard already branded "Ashyan Zafar": dark hero with serif "Crafting visual stories through edit.", ivory work grid (2 + 3), about/capabilities/let's-talk row, dark footer. The base layout. |
| "CUTLINE — first page" | **cutline.in** (title "CUTLINE \| Visual Post-Production Studio", Mumbai) | Intro hero: blurred grayscale NLE-timeline screenshot backdrop with a vignette and a thin playhead. After ~2s a big "Cut \| Line" wordmark appears ("t" drawn as a blade, red dots, vertical cut line between words, red "VISUAL" caps), an italic tagline, and a red bouncing "Scroll to explore". Inter 900 italic caps, orange accent (not used). Work thumbs are grayscale, numbered. → Becomes our intro sequence (docs/01 "Intro"). (cutlinestudio.ai and cutlineproduction.com are unrelated.) |
| "Mario Monteiro — perfect visual, not font/colours" | mariomonteiro.tv | Flow: hero → logo strip with hairlines → Featured Work 3-col (title, client, category in red · year, under each image) → manifesto mixing *serif italic* and SANS CAPS → centred "Let's craft something together" + email + arrow → footer. Fonts Syne/Instrument Serif/JetBrains Mono, orange accent (rejected). |
| "Zylitch — cursor, blade instead of square" | zylitch-next.vercel.app (repo humairaambreen/zylitch) | Custom cursor that follows direction (`atan2`) and leaves a paw-print trail in a fixed container. GSAP Flip + Lenis. Pink theme (not used). |

Client follow-ups: palette must be **black/white/red**, feel **luxury**, mobile pathways planned explicitly. Stand-in imagery (7 stills: hero, 5 work covers, studio) was generated in ChatGPT through the user's browser session and saved as WebP in `public/media/`. Prompt recipe: "Cinematic film still, landscape 16:9, palette strictly black, white and deep cinema red (red only as a small accent), high contrast, subtle 35mm grain, anamorphic, luxury. No text, no logos, no watermark." Scripted downloads (fetch the img blob, then click an anchor) land in ~/Downloads after a few seconds. The Selected Work section uses the ink tone (the ivory version looked off).

## Testing (Vitest 5)

- `vitest.config.mts` defines two projects: **unit** (node, `src/**/*.test.ts`, setup `test/setup.unit.ts`) and **components** (jsdom, `src/**/*.test.tsx`, setup `test/setup.dom.ts`). Tests sit next to the code they cover. Anything needing DOM APIs (XHR, File) uses `.test.tsx`.
- Vite 8 resolves `@/` with `resolve.tsconfigPaths: true` (no plugin). `server-only` is aliased to `test/stubs/empty.ts`. `next/cache` is mocked in unit setup and `next/image` is a plain `<img>` in DOM setup, with `preload` / `quality` / `fill` exposed as `data-*` attributes for assertions. `test/dom-utils.ts` has `mockMatchMedia`.
- Mock Prisma with `vi.hoisted` + `vi.mock("@/lib/db", …)`, then `await import()` the module under test. Config sets `clearMocks`, `restoreMocks`, `unstubEnvs` and `unstubGlobals`, so `vi.stubEnv`/`vi.stubGlobal` are per-test.
- **Async Server Components can't be rendered in Vitest** (Next guidance). Test their data through `features/content/queries` and leave rendering to E2E.
- Coverage is ~70% lines (2026-11-11). Untested: Better Auth wiring, the Vercel Blob and Cloudflare Stream upload calls (need live accounts), and async layouts. The tests were mutation-checked: breaking the open-redirect guard, JSON-LD escaping or the webhook replay window each fails a test.
- Local-route tests write to `public/uploads/test-vitest/` and clean up after themselves.

## Testing tips

- The Chrome window is maximized, so `resize_window` doesn't change the viewport. To check phone layouts, replace the page with 390px-wide iframes of `/` via `javascript_tool` (same origin) and screenshot.
- `curl -I localhost:3000/admin` should 307 to `/login?next=/admin` without a session cookie.
