# 06 · Roadmap

Tracked as GitHub issues, labelled `phase-1` … `phase-6`, plus `decision` for client inputs ([#1](https://github.com/nabeel-w/AshyanPortfolio/issues/1)).

| Phase | Issues |
|---|---|
| 1 · Data | #2 Neon + migration + seed · #3 cached content queries · #4 project pages |
| 2 · Media | #5 media adapter + uploads · #6 media library · #7 VideoLoop / FilmPlayer · #22 Google Drive import + upload modal (YouTube dropped) |
| 3 · Editor | #8 preview route + bridge · #9 3-pane editor · #10 publish + revisions |
| 4 · Admin | #11 projects · #12 client logos · #13 contact + inbox · #14 settings |
| 5 · Analytics | #15 collection · #16 rollups · #17 dashboard |
| 6 · Launch | #18 motion polish · #19 SEO/GEO · #20 mobile perf + a11y audit · #21 launch |
| 7 · v2 | Epic #32 · #23 marquee count · #24 video model · #25 YouTube player · #26 Blob-only media · #27 remove Mux · #28 labels · #29 bento grid · #30 orientation-aware project page · #31 audit findings · #33 share card settings |

| Phase | Scope | Status |
|---|---|---|
| **0 · Foundation** | Next 16 + TS + Tailwind v4 + shadcn, pnpm, Prisma 7 + Neon schema, Better Auth, env validation, design tokens, fonts, home page from fallback content, blade cursor, SEO basics (metadata, JSON-LD, sitemap, robots, llms.txt), plan docs | ✅ Done |
| **1 · Data wiring** | Neon project + first migration, seed, `features/content` cached queries, home reads `publishedData`, project pages `/work/[slug]` with `generateStaticParams` | ✅ Done (#2, #3, #4) — hosting env moves to #21 |
| **2 · Media** | Pick storage (docs/03), `features/media` adapter, Media library UI, direct uploads, blur/dominant colour, `VideoLoop` + film player | ✅ Done (#5, #6, #7, #22) — replaced in phase 7 by Vercel Blob + YouTube; Drive import via the Upload dialog |
| **3 · Visual editor** | `/preview/[slug]`, 3-pane editor, schema-driven inspector, dnd reorder, autosave, publish + revisions, device toggles | ✅ Done (#8, #9, #10) |
| **4 · Projects, Clients, Inbox, Settings** | CRUD screens, contact form + email notification, marquee logo management | ✅ Done (#11–#14) — enquiry emails go out through the linked Gmail account (Settings → Connected services) |
| **5 · Analytics** | Beacon, ingest, rollups, dashboard (docs/04) | ✅ Done (#15, #16, #17) — set `CRON_SECRET` + `ANALYTICS_SALT` on Vercel at launch |
| **6 · Polish & launch** | Reveal animations, Lenis, CUTLINE-style intro, OG images ✅, VideoObject JSON-LD ✅, Lighthouse pass on mobile (#20, findings in docs/08; Lighthouse CI on every deployment), real content, replace `public/media` stand-ins with real stills, domain + Vercel deploy | |
| **7 · v2** (client round 2, 2026-11-25) | YouTube films behind a click-to-load facade, Blob-only media (images + hover loops), Mux/Cloudflare/S3 removed; managed labels with `/work/label/<slug>` pages; bento grid that fits reels; project pages shaped by the film's orientation; Settings → Sharing & SEO with a live share-card preview | ✅ Built on `feat/v2-media-labels-bento` — after release: `pnpm media:mux-teardown --yes`, delete the Mux webhook, `pnpm db:deploy` (drops the Mux/Category columns) |

## Open questions for the client

1. ~~CUTLINE reference URL~~: cutline.in, analysed in docs/01 ("Intro").
2. ~~Storage choice~~: decided 2026-11-25 — films on YouTube, everything else on Vercel Blob (docs/03, costs in docs/07).
3. Real client list and logos for the marquee (the placeholder names are illustrative only).
4. Should AI crawlers be allowed (recommended for GEO)?
5. Domain name and the admin email(s).
