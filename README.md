# Ashyan Zafar — Film Editor Portfolio

Cinematic portfolio and admin CMS for film editor **Ashyan Zafar**. Built with Next.js 16 (Cache Components), Tailwind v4, shadcn/ui, Prisma 7 + Neon and Better Auth.

## Quick start

```bash
pnpm install
cp .env.example .env.local     # fill in Neon + auth values
cp .env.example .env           # Prisma CLI reads .env
pnpm db:migrate && pnpm db:seed
pnpm dev                       # http://localhost:3000
```

Create the first admin by signing up with an email listed in `ADMIN_EMAILS` (see `prisma/seed.ts`), then visit `/login`.

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
