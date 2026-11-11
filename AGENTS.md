<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ashyan Zafar — portfolio · project memory

Portfolio + admin CMS for **Ashyan Zafar, film editor**. The selling point is the UI: luxury, cinematic, **black · white · red**, instant loads, best-in-class SEO/GEO, and a mobile layout designed on purpose (not just shrunk).
Repo: `github.com/nabeel-w/AshyanPortfolio` (branch `main`). Push as gh account **nabeel-w** (the machine's active gh account is `nabeel-uprez`, so switch with `gh auth switch -u nabeel-w`).

Plans live in `docs/`: 01 design direction · 02 architecture/folders/editor · 03 asset storage · 04 analytics dashboard · 05 SEO/GEO · 06 roadmap + open questions. **Read them before building a feature.**

## Commands (pnpm only — never npm/yarn)

```
pnpm dev            # http://localhost:3000
pnpm build          # prisma generate && next build
pnpm lint | pnpm typecheck | pnpm format
pnpm db:migrate     # prisma migrate dev (uses DIRECT_URL)
pnpm db:seed        # tsx prisma/seed.ts
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
- **Prisma pinned to 7.10.1** (`prisma`, `@prisma/client`, `@prisma/adapter-neon`). On npm, `latest` currently points to **8.0.0-rc**, so never bare-install `prisma`. Generator `prisma-client` outputs to `src/generated/prisma` (gitignored; `postinstall` regenerates it). Import from `@/generated/prisma/client`. The CLI config is `prisma.config.ts` (`prisma init` names it `prisma7.config.ts`; we renamed it). The CLI uses `DIRECT_URL`; the runtime uses the pooled `DATABASE_URL` through `PrismaNeon`.
- **pnpm 11** blocks install scripts unless whitelisted in `pnpm-workspace.yaml` → `allowBuilds` (prisma, @prisma/engines, sharp, esbuild, unrs-resolver). Add new native deps there.
- **Better Auth 1.7**: `src/lib/auth.ts` (server, `server-only`), `src/lib/auth-client.ts`, handler `app/api/auth/[...all]`. Sign-up is restricted to `ADMIN_EMAILS` by a `databaseHooks.user.create.before` hook. `requireAdmin()` (`src/lib/session.ts`) is the real gate; proxy is optimistic only.
- `src/lib/env.ts` validates env with zod at import. **Any server module importing db/auth needs a valid `.env.local`.** `.env.local` holds local placeholders; `.env.example` is the committed template (gitignore has `!.env.example`).
- Seed and scripts run with **tsx** (Node type-stripping can't resolve the generated client's imports).

## Architecture conventions

- Route groups: `(site)` is public, static and cached; `(auth)/login`; `admin/*` is private (noindex).
- **Section system** = the editor's core: `src/features/sections/schemas.ts` (one zod schema per section type) + `registry.tsx` (type → component + `SectionRenderer`). To add a section: schema, then component in `components/site`, then registry entry. DB `Section.data` is the draft and `publishedData` is live.
- Content is currently from `src/content/fallback.ts`. Swap to cached DB queries in `features/content` (see docs/02 "Rendering & caching").
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
| "CUTLINE — first page" | **not found** | cutlinestudio.ai (SaaS) and cutlineproduction.com (UAE studio) don't match "CUTLINE \| Visual Post-Production Studio". **Ask the client for the URL.** |
| "Mario Monteiro — perfect visual, not font/colours" | mariomonteiro.tv | Flow: hero → logo strip with hairlines → Featured Work 3-col (title, client, category in red · year, under each image) → manifesto mixing *serif italic* and SANS CAPS → centred "Let's craft something together" + email + arrow → footer. Fonts Syne/Instrument Serif/JetBrains Mono, orange accent (rejected). |
| "Zylitch — cursor, blade instead of square" | zylitch-next.vercel.app (repo humairaambreen/zylitch) | Custom cursor that follows direction (`atan2`) and leaves a paw-print trail in a fixed container. GSAP Flip + Lenis. Pink theme (not used). |

Client follow-ups: palette must be **black/white/red**, feel **luxury**, mobile pathways planned explicitly. Stand-in imagery (7 stills: hero, 5 work covers, studio) was generated in ChatGPT through the user's browser session and saved as WebP in `public/media/`. Prompt recipe: "Cinematic film still, landscape 16:9, palette strictly black, white and deep cinema red (red only as a small accent), high contrast, subtle 35mm grain, anamorphic, luxury. No text, no logos, no watermark." Scripted downloads (fetch the img blob, then click an anchor) land in ~/Downloads after a few seconds. The Selected Work section uses the ink tone (the ivory version looked off).

## Testing tips

- The Chrome window is maximized, so `resize_window` doesn't change the viewport. To check phone layouts, replace the page with 390px-wide iframes of `/` via `javascript_tool` (same origin) and screenshot.
- `curl -I localhost:3000/admin` should 307 to `/login?next=/admin` without a session cookie.
