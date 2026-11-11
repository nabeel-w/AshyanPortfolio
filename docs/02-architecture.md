# 02 · Architecture, folder structure & visual editor

## Stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js App Router, Turbopack, **Cache Components + Partial Prefetching on** | 16.4.6 |
| UI | React 19, Tailwind CSS v4, shadcn/ui (`base-nova` style = Base UI primitives, not Radix) | 19.3 / 4.3 |
| Motion | `motion`, `lenis`; CSS for anything simple | 14 / 1.3 |
| DB | Neon Postgres + Prisma ORM (`prisma-client` generator, Neon driver adapter) | 7.10.1 |
| Auth | Better Auth (email + password, invite-only through `ADMIN_EMAILS`) | 1.7 |
| Validation | zod 4 | — |
| Editor | dnd-kit (reorder), react-hook-form + zod resolver, shadcn resizable panels | — |
| Charts | shadcn `chart` (Recharts) | — |
| Package manager | **pnpm 11** | — |

## Folder structure

```
.
├── AGENTS.md                    # Project memory for AI agents: findings, quirks, conventions
├── assets/                      # Client-supplied source files (moodboard); not served
├── docs/                        # These plans
├── prisma/
│   ├── schema.prisma            # Auth, assets, projects, pages/sections, analytics
│   ├── seed.ts                  # Site settings + home sections
│   └── migrations/
├── prisma.config.ts             # CLI config (loads .env.local; direct host for migrations)
├── scripts/create-admin.ts      # pnpm admin:create
├── public/media/                # ChatGPT-generated on-brand stills (stand-ins until real frames)
└── src/
    ├── proxy.ts                 # Optimistic /admin gate (cookie check only)
    ├── app/
    │   ├── layout.tsx           # <html>, fonts, global metadata
    │   ├── globals.css          # Design tokens and utilities
    │   ├── (site)/              # PUBLIC — static, cached, SEO
    │   │   ├── layout.tsx       # Header, footer, blade cursor, Person/WebSite JSON-LD
    │   │   ├── page.tsx         # Home = SectionRenderer(home)
    │   │   ├── work/[slug]/     # Project page + opengraph-image.tsx      (next)
    │   │   ├── about/           #                                          (next)
    │   │   └── contact/         #                                          (next)
    │   ├── (auth)/login/        # Sign-in
    │   ├── admin/               # PRIVATE — requireAdmin() in a Suspense guard
    │   │   ├── layout.tsx       # Shell + nav
    │   │   ├── page.tsx         # Overview KPIs
    │   │   ├── analytics/       # Dashboard (docs/04)                      (next)
    │   │   ├── pages/[slug]/    # Visual section editor                    (next)
    │   │   ├── projects/        # Project CRUD + editor                     (next)
    │   │   ├── media/           # Asset library + uploads                  (next)
    │   │   ├── clients/         # Marquee logos                            (next)
    │   │   ├── inbox/           # Contact submissions                      (next)
    │   │   └── settings/        # SiteSettings, SEO defaults               (next)
    │   ├── preview/[slug]/      # Draft render for the editor iframe (admin only, noindex)  (next)
    │   ├── api/
    │   │   ├── auth/[...all]/   # Better Auth handler
    │   │   ├── analytics/       # Beacon endpoint                          (next)
    │   │   ├── uploads/         # Signed direct-upload URLs                (next)
    │   │   └── webhooks/mux/    # Asset ready → status + revalidate        (next)
    │   ├── sitemap.ts · robots.ts · llms.txt/route.ts
    ├── components/
    │   ├── ui/                  # shadcn (generated; edit sparingly)
    │   ├── site/                # Public visual components (server-first)
    │   └── admin/               # Editor and dashboard components          (next)
    ├── features/                # Domain logic, grouped by feature
    │   ├── sections/            # schemas.ts (zod) + registry.tsx (renderer). The editor's core
    │   ├── seo/                 # JSON-LD builders, metadata helpers
    │   ├── content/             # queries.ts ("use cache" + tags) · tags.ts · invalidate.ts (updateTag helpers)
    │   ├── media/               # Storage adapter interface + provider impls          (next)
    │   └── analytics/           # Beacon, ingest, rollups, dashboard queries          (next)
    ├── content/fallback.ts      # Placeholder content until the DB has content
    ├── generated/prisma/        # Prisma client output (gitignored, built on install)
    ├── hooks/
    └── lib/                     # env, db, auth, auth-client, session, site-url, utils
```

Rules:
- Server Components by default. A file becomes `"use client"` only when it needs browser APIs or state, and it should be a small leaf (an "island"). Current client JS on the home page: cursor, timecode, mobile menu.
- `features/*` holds logic, `components/*` holds presentation. Pages stay thin.
- Every DB read for the public site goes through `features/content`, wrapped in `"use cache"` + `cacheTag(...)`.

## Rendering & caching

```
Admin edits → Server Action saves Section.data (draft)  ─┐
                                                          │ "Publish"
                     ┌────────────────────────────────────┘
                     ▼
  transaction: data → publishedData, PageRevision snapshot
  updateTag(`page:${slug}`) / updateTag("projects") / updateTag("site")
                     ▼
Public route (static shell) ← "use cache" getPublishedPage(slug) { cacheTag(`page:${slug}`); cacheLife("max") }
```

- Public pages are fully prerendered (`○` in build output) and served from the CDN. Publishing invalidates **only** the affected tags.
- Tags: `site`, `page:<slug>`, `projects`, `project:<slug>`, `clients`, `assets`.
- Anything that reads the session (admin) sits behind `<Suspense>`. This is required by Cache Components.
- Don't call `new Date()`, `Math.random()` or similar in prerendered server code (Cache Components errors on it). Use stored values or move it to a client island.

## Visual section editor (`/admin/pages/[slug]`)

```
┌─────────────┬──────────────────────────────────────┬──────────────────┐
│ SECTIONS    │  [Desktop] [Tablet] [Phone]   ◉ Draft │ INSPECTOR        │
│ ⠿ Hero      │ ┌──────────────────────────────────┐ │ Hero             │
│ ⠿ Clients   │ │                                  │ │ Eyebrow  [____]  │
│ ⠿ Work grid │ │   live preview iframe            │ │ Headline [____]  │
│ ⠿ Statement │ │   /preview/home                  │ │ *italic* = red   │
│ ⠿ About     │ │   (click a section → select it)  │ │ Media   [Pick…]  │
│ ⠿ Contact   │ │                                  │ │ CTA     [____]   │
│ + Add       │ └──────────────────────────────────┘ │ [Hide] [Dup] [🗑]│
│             │  Autosaved 12s ago   [Revisions] [Publish]               │
└─────────────┴──────────────────────────────────────┴──────────────────┘
```

- **Single source of truth**: `features/sections/schemas.ts`. Each section type has a zod schema. It validates saves and drives the inspector form fields: strings become inputs, `mediaRef` becomes the media picker, arrays become repeaters. `registry.tsx` maps the type to its component.
- **Instant preview**: the inspector posts draft props to the iframe (`postMessage`). The preview page holds them in client state and re-renders `SectionRenderer`, with no network round-trip. Autosave runs a debounced (800ms) server action into `Section.data`.
- **Device toggles** resize the iframe to 1440 / 820 / 390, so mobile layouts get checked on every edit.
- **Click to edit**: preview sections carry `data-section-id`. Clicking one posts its id back to the editor, which selects it.
- **Reorder**: dnd-kit sortable list, which persists `order`.
- **Publish** copies draft to live in one transaction, snapshots a `PageRevision`, and invalidates tags. **Revisions** drawer offers one-click rollback.
- Projects use the same editor, with a project-specific section set (`ProjectHero`, `Film`, `Gallery`, `Credits`, `Text`).

## Auth

- Better Auth with the Prisma adapter, email + password, 7-day sessions, 5-minute cookie cache.
- Sign-up endpoint exists but a DB hook rejects any email not in `ADMIN_EMAILS`. The first admin signs up once (curl in `prisma/seed.ts`).
- `src/proxy.ts` is an optimistic cookie check only. The real check is `requireAdmin()` in the admin layout and in **every** server action.
- Later options: passkeys or 2FA plugin, rate limiting on sign-in.
