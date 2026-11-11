# 04 · Analytics dashboard plan (`/admin/analytics`)

Purpose: show Ashyan **what work gets watched, where viewers come from (including AI assistants), and what turns into enquiries**. It's first-party, cookieless and lightweight, so no consent banner is needed.

## 1. Collection

**Beacon** (`features/analytics/beacon.tsx`, a client island under 1 KB): sends events with `navigator.sendBeacon` to `POST /api/analytics`.

| Event | When | `value` / `label` |
|---|---|---|
| `PAGEVIEW` | Route change | — |
| `PROJECT_OPEN` | Project page view | projectId |
| `VIDEO_PLAY` | Player starts | projectId |
| `VIDEO_PROGRESS` | Crosses 25/50/75% | 25 \| 50 \| 75 |
| `VIDEO_COMPLETE` | Reaches 95%+ | 100 |
| `CTA_CLICK` | "Let's talk", email, view work | label = CTA id |
| `OUTBOUND_CLICK` | Social / external links | label = host |
| `CONTACT_SUBMIT` | Form success | — |

**Ingest** (`app/api/analytics/route.ts`, Node runtime):
- Drop known bots (UA list) and admin sessions.
- `visitorHash = sha256(ANALYTICS_SALT + day + ip + ua)`. This rotates daily, and the IP is **never stored**.
- `source`: classify the referrer as `AI` (chatgpt.com, chat.openai.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com, you.com…), `SEARCH`, `SOCIAL`, `EMAIL`, `REFERRAL`, `DIRECT`, or by UTM.
- Country from the platform geo header (`x-vercel-ip-country`), device and browser from the UA.
- Write to `AnalyticsEvent`. Rate-limit by `sessionHash`.

**Rollup**: a nightly cron (`vercel.ts` crons, or Neon `pg_cron`) upserts `AnalyticsDaily` per day and path. The dashboard reads rollups for long ranges and raw events for today. Raw events are kept for 90 days.

**Complement**: enable Vercel **Speed Insights** (real-user Core Web Vitals) and optionally Web Analytics. Mux Data covers video quality of experience (startup time, rebuffering).

## 2. Dashboard layout

```
┌ Analytics ───────────────────────────── [7d] [30d] [90d] [Custom] [⤓ CSV] ┐
│ Visitors   Page views   Video plays   Avg watch %   Enquiries   Conv. %   │ ← KPI tiles + delta vs previous period + sparkline
├───────────────────────────────────────────────────────────────────────────┤
│ Visitors & plays over time (area, 2 series)                                │
├──────────────────────────────────┬────────────────────────────────────────┤
│ Traffic sources (bar)            │ Video retention funnel                 │
│ Direct · Search · AI ★ · Social  │ Play → 25 → 50 → 75 → Complete         │
├──────────────────────────────────┴────────────────────────────────────────┤
│ Top projects: views · plays · completion % · enquiries attributed          │
├──────────────────────────────┬──────────────────────┬─────────────────────┤
│ Top referrers                │ Devices (mobile/desk) │ Countries           │
├──────────────────────────────┴──────────────────────┴─────────────────────┤
│ Live: visitors in the last 30 min · latest enquiries (links to Inbox)       │
└───────────────────────────────────────────────────────────────────────────┘
```

- Built with shadcn `chart` (Recharts), `table`, `card` and `tabs`. Colours come from the brand tokens: red is the primary series, ivory the secondary, greys for the rest. "AI" traffic is always highlighted in red because it tracks GEO.
- On a phone, tiles go 2-up, charts go full width, and tables become scrollable cards.
- Data access: server components call `features/analytics/queries.ts` (`"use cache"`, `cacheLife("minutes")`, `cacheTag("analytics")`). The date range lives in `searchParams`, and KPI deltas are computed in SQL.
- The Overview page (`/admin`) reuses the KPI tiles (7 days) plus the latest enquiries.

## 3. Build order

1. Beacon + ingest + bot filter + source classifier (with unit tests for the classifier).
2. KPI tiles + time series from raw events.
3. Rollup cron + switch long ranges to `AnalyticsDaily`.
4. Video funnel (needs the player from docs/03).
5. Projects table, referrers, devices, countries, CSV export.
6. Live counter (poll every 30s; no websockets needed).
