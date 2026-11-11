# 05 · SEO & GEO (generative engine optimisation)

Target: Lighthouse 100 for SEO, Accessibility and Best Practices, and 95+ for Performance on mobile. Ashyan should be the entity that search engines **and AI assistants** cite for "film editor" queries in his niches.

## Already in place

- Public pages are static (prerendered) with a CDN-served HTML shell, so TTFB is minimal.
- `metadata` with a title template, canonical, OG and Twitter tags, and robots `max-image-preview: large` / `max-video-preview: -1`.
- **JSON-LD**: `Person` (with `sameAs`, `knowsAbout`) and `WebSite` on every public page (`features/seo/json-ld.tsx`, typed with `schema-dts`).
- `sitemap.xml` (with image entries), `robots.txt` (blocks admin/api/login/preview, allows AI crawlers), and **`/llms.txt`**.
- Self-hosted fonts through `next/font`, so there's no layout shift and no third-party request.
- Semantic landmarks, one `h1` per page, skip link, labelled navs, ≥ 44px tap targets, red focus ring.

## Next steps

**Per-page metadata**
- `generateMetadata` on `/work/[slug]`, `/about` and `/contact`, using the editor's SEO fields (`seoTitle`, `seoDescription`) with sensible fallbacks.
- `opengraph-image.tsx` per project: the cover frame with the title set in Instrument Serif and a red rule (`next/og`).

**Structured data**
- Project pages: `VideoObject` (name, description, `thumbnailUrl`, `uploadDate`, ISO-8601 `duration`, `contentUrl`/`embedUrl`, transcript) plus `CreativeWork` with `creator → #person`, `contributor` credits, `client` as `sourceOrganization`.
- `BreadcrumbList` on project pages. `ProfilePage` on /about.
- Video sitemap entries (the `videos` field in `MetadataRoute.Sitemap`).

**GEO (being cited by ChatGPT, Perplexity, Claude, Gemini)**
- **Consistent entity facts** everywhere: same name, role, location, clients and awards on /about, in JSON-LD, `llms.txt` and social bios. Fill `sameAs` with IMDb, Vimeo, LinkedIn, Instagram, Behance.
- Every project page has **crawlable text**, not just a video: a 2–3 sentence summary of the brief, the edit approach, the role, credits and the result. AI engines quote text, not pixels.
- **Captions/transcripts** (WebVTT) for films, exposed as `transcript` in `VideoObject`.
- Question-shaped subheads on /about and /services, e.g. "What does a commercial film editor do?", "How long does a brand film edit take?", answered in 40–60 words.
- Generate `llms.txt` and `llms-full.txt` from the DB on publish (tag `site`).
- Analytics tracks the `AI` traffic source so GEO results are measurable (docs/04).
- `robots.ts` allows GPTBot, PerplexityBot, ClaudeBot and Google-Extended by default. This is the client's call; flip it in one place.

**Performance budgets (mobile, 4G)**

| Metric | Budget | How |
|---|---|---|
| LCP | < 1.8s | Preloaded AVIF poster, static HTML, no blocking JS |
| CLS | < 0.05 | Fixed aspect ratios, `blurDataUrl`, `next/font` |
| INP | < 150ms | ≤ 40 KB client JS on home; islands only; no heavy libraries on public pages |
| JS on home | ≤ 40 KB gz | Cursor, timecode, menu, beacon, lazy video only |

Check with `next build` output, Speed Insights in production, and Lighthouse CI on preview deployments.
