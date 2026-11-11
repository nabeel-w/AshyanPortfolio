# 04 · Analytics dashboard plan (`/admin/analytics`)

Purpose: show Ashyan **what work gets watched, where viewers come from (including AI assistants), and what turns into enquiries**. It's first-party, cookieless and lightweight, so no consent banner is needed.

## 1. Collection

**Beacon** (`features/analytics/beacon.tsx` + `track.ts`, a client island under 1 KB): sends events with `navigator.sendBeacon` to `POST /api/analytics`. The referrer and query string go with the first pageview of each document only.

| Event | When | `value` / `label` |
|---|---|---|
| `PAGEVIEW` | Route change | — |
| `PROJECT_OPEN` | Not sent: the server sets `projectId` on every event whose path is `/work/<slug>`, so project opens = pageviews with a projectId | — |
| `VIDEO_PLAY` | Player starts | projectId |
| `VIDEO_PROGRESS` | Crosses 25/50/75% | 25 \| 50 \| 75 |
| `VIDEO_COMPLETE` | Reaches 95%+ | 100 |
| `CTA_CLICK` | Any element with `data-cta="<id>"`, plus mailto/tel links | label = CTA id |
| `OUTBOUND_CLICK` | Social / external links | label = host |
| `CONTACT_SUBMIT` | Form success, recorded **server-side** in `submitContact` (the beacon can't send it, so leads can't be spoofed) | — |

**Ingest** (`app/api/analytics/route.ts`, Node runtime):
- Drop known bots (UA list) and admin sessions.
- `visitorHash = sha256(ANALYTICS_SALT + day + ip + ua)`. This rotates daily, and the IP is **never stored**.
- `source`: classify the referrer as `AI` (chatgpt.com, chat.openai.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com, you.com…), `SEARCH`, `SOCIAL`, `EMAIL`, `REFERRAL`, `DIRECT`, or by UTM.
- Country from the platform geo header (`x-vercel-ip-country`), device and browser from the UA.
- Sessions: an event within 30 min of the visitor's previous one continues that session and inherits its source/referrer/UTM; a new external referrer or campaign starts a new session.
- Write to `AnalyticsEvent`. Rate-limited per visitor (120 events/min, per instance). Same-origin only; invalid bodies get 400, everything valid gets 204 (filtered or not).

**Rollup** (`features/analytics/aggregate.ts` + `rollup.ts`): Vercel Cron (`vercel.json`, 00:15 UTC) calls `GET /api/cron/analytics` with `Authorization: Bearer $CRON_SECRET`. It rebuilds every finished UTC day without a rollup (always redoing yesterday) into `AnalyticsDaily` (per day + path; path `"*"` = whole site) and `AnalyticsDailyDim` (source, referrer, device, country, browser, cta, outbound), then deletes raw events older than 90 days. `pnpm analytics:rollup --from … --to …` backfills. The dashboard reads rollups and runs the **same** aggregation live over raw events for today and any day the cron hasn't covered, so the numbers always mean the same thing. (`vercel.json` rather than `vercel.ts`: `@vercel/config` was still 0.x and brand new.)

Metric definitions: visitors = daily-unique visitor hashes, summed over days (the hash rotates daily, so a range can't dedupe across days). Avg watch = mean of the furthest milestone (0/25/50/75/100) reached per played session and film. A project's enquiries = sessions that viewed it and enquired the same day.

**Complement**: Vercel **Speed Insights** (real-user Core Web Vitals) is mounted in the site layout (`@vercel/speed-insights` pinned to 2.0.0); it also has to be switched on in the Vercel project (Speed Insights tab) at launch. Web Analytics is optional. Mux Data covers video quality of experience (startup time, rebuffering).

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

- Only the time series uses Recharts (shadcn `chart`, crosshair tooltip). KPI sparklines, ranked bars, the retention funnel, the device split and the tables are server-rendered HTML/SVG, so they cost no JS. Colours are a brand **emphasis** palette, not a categorical one: red marks the series that matters (film plays, AI traffic, completion), warm grey (#b8b3ab) everything else. The dataviz palette check passes CVD separation, normal-vision distance and contrast on onyx; it flags the greys as "reads gray", which is the point. Every multi-series chart has a legend, and every chart has a table view or printed values. "AI" traffic is always highlighted in red because it tracks GEO.
- On a phone, tiles go 2-up, charts go full width, and tables become scrollable cards.
- Data access: server components call `features/analytics/queries.ts` (`"use cache"`, `cacheLife("minutes")`, `cacheTag("analytics")`). The date range lives in `searchParams`, and KPI deltas are computed in SQL.
- The Overview page (`/admin`) reuses the KPI tiles (7 days) plus the latest enquiries.

## 3. Build order (all done: #15, #16, #17)

1. Beacon + ingest + bot filter + source classifier (with unit tests for the classifier).
2. KPI tiles + time series from raw events.
3. Rollup cron + switch long ranges to `AnalyticsDaily`.
4. Video funnel (needs the player from docs/03).
5. Projects table, referrers, devices, countries, CSV export.
6. Live counter (poll every 30s; no websockets needed).
