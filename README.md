# Ashyan Zafar — Film Editor Portfolio

Cinematic portfolio and admin CMS for film editor **Ashyan Zafar**. Built with Next.js 16 (Cache Components), Tailwind v4, shadcn/ui, Prisma 7 + Neon and Better Auth.

## Quick start

```bash
pnpm install
cp .env.example .env.local          # fill in Neon + auth values (Prisma CLI reads it too)
pnpm db:deploy && pnpm db:seed      # apply migrations, seed settings + home sections
pnpm admin:create you@example.com "Your Name"   # email must be in ADMIN_EMAILS; password prompt is hidden
pnpm dev                            # http://localhost:3000 → /login → /admin
pnpm media:check                    # which storage provider handles what, and what's missing
```

## Docs

| Doc | What's in it |
|---|---|
| [AGENTS.md](AGENTS.md) | Project memory: stack quirks, conventions, reference-site findings |
| [01 · Design direction](docs/01-design-direction.md) | References, palette, type, motion, mobile pathways |
| [02 · Architecture](docs/02-architecture.md) | Folder structure, caching model, visual editor, auth |
| [03 · Asset storage](docs/03-asset-storage.md) | Video/image storage options and delivery rules |
| [04 · Analytics dashboard](docs/04-analytics-dashboard.md) | Cookieless tracking and dashboard plan |
| [05 · SEO & GEO](docs/05-seo-geo.md) | Structured data, llms.txt, performance budgets |
| [06 · Roadmap](docs/06-roadmap.md) | Phases and open questions |
| [07 · Storage costs](docs/07-storage-costs.md) | Cost estimate for 200 GB, provider comparison, client markup |
