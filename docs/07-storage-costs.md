# 07 · Storage & delivery cost estimate — 200 GB of assets

Prices are list prices gathered on **2026-11-11** from public pricing pages and recent comparisons (sources at the bottom). They change often, so re-check each provider's pricing page before quoting a client. All figures are USD per month unless noted.

## Assumptions

**Library: 200 GB total**

| Part | Size | What it means |
|---|---|---|
| Video masters | 180 GB | At ~10 Mbps (high-quality 1080p H.264 export ≈ 75 MB/min) this is **~2,400 minutes (~40 h)** of film |
| Images, logos, PDFs | 20 GB | Stills, posters, client logos |

> Streaming providers (Mux, Cloudflare Stream) bill by **minutes of video, not GB**. The same 180 GB is only ~160 min if the files are ProRes (~150 Mbps) or ~530 min as 4K H.264 (~45 Mbps). The per-minute rows below scale with that.

**Traffic scenarios**

| | Low | Medium | High |
|---|---|---|---|
| Visits / month | 3,000 | 15,000 | 60,000 |
| Film minutes watched (35% of visits × 1.5 min) | 1,575 | 7,875 | 31,500 |
| Video GB delivered (adaptive 1080p ≈ 37.5 MB/min) | 59 GB | 295 GB | 1,181 GB |
| Image GB delivered (≈ 4 MB/visit, AVIF) | 12 GB | 60 GB | 240 GB |

## Video providers (180 GB ≈ 2,400 min)

| Provider | Pricing used | Low | Medium | High | Notes |
|---|---|---|---|---|---|
| **Mux** (basic quality, 1080p) | Storage $0.003/min/mo; delivery: first 100k min/mo free, then $0.001/min; basic encoding free | **$7.20** | **$7.20** | **$7.20** | Delivery stays free up to ~100k min/mo (~190k visits at these assumptions). "Plus"/"premium" quality adds cost; check Mux pricing |
| **Cloudflare Stream** | $5 per 1,000 min stored (billed in 1,000-min blocks); $1 per 1,000 min delivered; encoding free | $16.60 | $22.90 | $46.50 | 3 storage blocks = $15 fixed. Direct uploads ≤ 200 MB unless tus is used |
| **Bunny Stream** | Storage ~$0.01/GB/mo; delivery ~$0.01 (EU/NA) to $0.03 (Asia)/GB, blended $0.02; encoding free; $1 minimum | $3.20 | $7.90 | $25.60 | Cheapest; fewer API niceties (no adapter yet; see docs/03 to add one) |
| Cloudinary (video too) | Credits: 1 credit = 1 GB storage or 1 GB image / 2 GB video bandwidth | — | — | — | 180 GB storage alone needs ~180 credits/mo, so **Advanced $249/mo** minimum |
| R2 only (progressive MP4, no streaming) | $0.015/GB/mo after 10 GB free, free egress | $2.55 | $2.55 | $2.55 | Cheapest but no adaptive bitrate: slow starts on mobile. Good as a **master archive**, not for playback |

## Images & files (20 GB)

| Provider | Pricing used | Low | Medium | High | Notes |
|---|---|---|---|---|---|
| **Cloudflare R2** | $0.015/GB/mo after 10 GB free; **egress free**; reads $0.36/M after 10M free | **$0.15** | **$0.15** | **$0.15** | Reads stay inside the free tier at these volumes |
| **Vercel Blob** | $0.023/GB/mo after 1 GB; transfer $0.05/GB after 10 GB (on-demand rate) | $0.54 | $2.94 | $11.94 | Worst case (every view hits Blob). With `next/image` caching, most views never reach Blob. On Pro, transfer may fall under the plan's included CDN usage |
| Cloudinary | Credit pool (see above) | $99 | $99 | $249 | Plus plan (225 credits) → Advanced (600) |

## Recommended stacks, all-in for 200 GB

| Stack | Low | Medium | High | Why |
|---|---|---|---|---|
| ⭐ **Mux + R2** | **$7.35** | **$7.35** | **$7.35** | Best playback quality per dollar; flat until very high traffic |
| Mux + Vercel Blob | $7.74 | $10.14 | $19.14 | Simplest if everything lives on Vercel |
| Bunny Stream + R2 | $3.35 | $8.05 | $25.75 | Lowest cost at low traffic |
| Cloudflare Stream + R2 | $16.75 | $23.05 | $46.65 | Predictable; one vendor (Cloudflare) |
| Cloudinary for everything | $249+ | $249+ | $249+ | Convenient, but 20–30× the cost at this size |

**Optional master archive**: keep the original 180 GB masters in R2 Infrequent Access ($0.01/GB/mo) for **~$1.80/mo**, so the streaming provider can be switched later without re-sourcing files.

**Not included**: site hosting (e.g. Vercel Pro seat, required for commercial sites), the Neon database plan, domain, and email. Price those separately.

## Client billing with markup

Base = recommended stack (Mux + R2) + master archive = **$9.15/mo** at every traffic level above.

| Markup | Monthly price | Yearly |
|---|---|---|
| Cost (0%) | $9.15 | $109.80 |
| +30% | $11.90 | $142.74 |
| +50% | $13.73 | $164.70 |
| +100% | $18.30 | $219.60 |

Suggestions:
- Bundle storage with hosting and maintenance into one "media & hosting" line item, and round up (e.g. a $25–40/mo package once hosting is added) instead of itemising pennies.
- Add a **usage clause**: the price covers up to ~250 GB stored and ~100k streamed minutes/month; above that, bill at cost + the agreed markup. The Mux free-delivery threshold is the main thing that could change the bill.
- Re-check prices each renewal; video platforms reprice often.

## How to re-run these numbers

Change the assumptions at the top and recompute:
- **Mux** = minutes stored × $0.003 + max(0, minutes watched − 100,000) × $0.001
- **Cloudflare Stream** = ceil(minutes stored / 1000) × $5 + minutes watched / 1000 × $1
- **Bunny** = GB stored × $0.01 + GB delivered × regional rate
- **R2** = max(0, GB − 10) × $0.015 (egress free)
- **Blob** = max(0, GB − 1) × $0.023 + max(0, GB delivered − 10) × $0.05

## Sources

- [Mux pricing 2026 (ActivePieces)](https://www.activepieces.com/blog/mux-pricing-in-2026-is-cheap-until-delivery-minutes-add-up) · [Mux pricing (PriceDeskHub)](https://pricedeskhub.com/mux-pricing/) · [Mux pricing (Play That Sells)](https://playthatsells.com/reviews/mux/pricing) · [Video encoding API comparison (Forasoft)](https://www.forasoft.com/blog/article/video-encoding-api-comparison)
- [Cloudflare Stream pricing 2026 (VeryGoodFFmpeg)](https://verygoodffmpeg.com/blog/cloudflare-stream-pricing-video-api-encoding-storage-delivery-2026) · [Cloudflare Stream pricing (ZeroBuffer)](https://www.zerobuffer.io/blogs/cloudflare-stream-pricing)
- [Bunny Storage pricing](https://bunny.net/pricing/storage/) · [Bunny Stream review (Swarmify)](https://swarmify.com/blog/bunny-stream-review/) · [Bunny CDN pricing 2026 (AIBizHub)](https://aibizhub.io/articles/bunny-cdn-pricing/) · [Bunny vs Cloudflare 2026](https://www.kunalganglani.com/blog/bunnynet-vs-cloudflare-2026)
- [Vercel Blob usage & pricing (official)](https://vercel.com/docs/vercel-blob/usage-and-pricing) · [Vercel pricing](https://vercel.com/pricing)
- [Cloudflare R2 pricing 2026 (Mecanik)](https://mecanik.dev/en/posts/cloudflare-r2-pricing-explained-real-costs-vs-s3-and-backblaze/) · [R2 pricing (BucketMate)](https://www.bucketmate.app/blogs/cloudflare-r2-pricing-2026)
- [Cloudinary pricing 2026 (DEV)](https://dev.to/nayankyada/cloudinary-pricing-2026-free-tier-limits-transformation-costs-when-to-upgrade-1h5h) · [Cloudinary pricing tiers (The Digital Project Manager)](https://thedigitalprojectmanager.com/tools/cloudinary-pricing/)
