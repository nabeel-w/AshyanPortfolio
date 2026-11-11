# 06 · Roadmap

| Phase | Scope | Status |
|---|---|---|
| **0 · Foundation** | Next 16 + TS + Tailwind v4 + shadcn, pnpm, Prisma 7 + Neon schema, Better Auth, env validation, design tokens, fonts, home page from fallback content, blade cursor, SEO basics (metadata, JSON-LD, sitemap, robots, llms.txt), plan docs | ✅ Done |
| **1 · Data wiring** | Neon project + first migration, seed, `features/content` cached queries, home reads `publishedData`, project pages `/work/[slug]` with `generateStaticParams` | Next |
| **2 · Media** | Pick storage (docs/03), `features/media` adapter, Media library UI, direct uploads, blur/dominant colour, Mux webhook, `VideoLoop` + `FilmPlayer` | |
| **3 · Visual editor** | `/preview/[slug]`, 3-pane editor, schema-driven inspector, dnd reorder, autosave, publish + revisions, device toggles | |
| **4 · Projects, Clients, Inbox, Settings** | CRUD screens, contact form + email notification, marquee logo management | |
| **5 · Analytics** | Beacon, ingest, rollups, dashboard (docs/04) | |
| **6 · Polish & launch** | Reveal animations, Lenis, preloader, OG images, VideoObject JSON-LD, Lighthouse pass on mobile, real content, replace `public/media` stand-ins with real stills, domain + Vercel deploy | |

## Open questions for the client

1. **CUTLINE reference URL**: the "Visual Post-Production Studio" site couldn't be found (see docs/01).
2. Storage choice: Mux + Vercel Blob (recommended) or a cheaper stack?
3. Real client list and logos for the marquee (the placeholder names are illustrative only).
4. Should AI crawlers be allowed (recommended for GEO)?
5. Domain name and the admin email(s).
