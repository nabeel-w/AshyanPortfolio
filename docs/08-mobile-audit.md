# 08 · Mobile performance & accessibility audit (#20)

Audited 2026-11-11 on production (`https://ashyan-portfolio.vercel.app`, commit `3f57a1d`). Lighthouse 12.8 mobile: Moto G Power emulation, simulated slow 4G, 4× CPU, two runs per page. Every successful Vercel deployment now runs the same check through **Lighthouse CI** (`.github/workflows/lighthouse.yml`, budgets in `lighthouserc.json`).

## Results

| Page | Performance | A11y | Best Pr. | SEO | LCP | FCP | TBT | CLS | JS (gz) |
|---|---|---|---|---|---|---|---|---|---|
| `/` | **93 / 94** | 100 | 100 | 100 | 3.1 s | 1.1–1.3 s | 23–40 ms | 0 | 177 KB |
| `/work` | 97 / 96 | 100 | 100 | 100 | 2.7 s | 1.0 s | 22–24 ms | 0 | 193 KB |
| `/about` | 97 / 98 | 100 | 100 | 100 | 2.5 s | 1.0 s | 39–72 ms | 0 | 186 KB |
| `/contact` | 97 / 97 | 100 | 100 | 100 | 2.5 s | 1.0 s | 37–78 ms | 0 | 186 KB |
| `/work/resonance` | 96 / 96 | 100 | 100 | 100* | 2.7 s | 1.0–1.6 s | 42–90 ms | 0 | 193 KB |

\* One of the two runs flagged `robots.txt` (a transient fetch failure); the other scored 100.

Before the fixes (production, same method): A11y **89–96** on /about, /work and /contact. Best Practices and SEO were below 100 because of the `robots.txt` `Host` line. /about scrolled sideways on phones.

### Against the #20 targets

| Target | Status |
|---|---|
| Lighthouse CI on preview deployments | ✅ Runs on every successful Vercel deployment. Previews behind Deployment Protection can't be audited without a secret, which we deliberately don't pass, because reports are artifacts |
| Performance ≥ 95 (mobile) | ✅ 4 of 5 pages (96–98). ⚠️ Home 93–94, see "Open" |
| SEO / A11y / Best Practices 100 | ✅ All pages |
| CLS < 0.05 | ✅ 0 everywhere |
| INP < 150 ms | ✅ in the lab proxy (TBT ≤ 90 ms). Field INP comes from Vercel Speed Insights once there's traffic |
| LCP < 1.8 s on 4G mid-range | ❌ Lab 2.5–3.1 s. FCP is ~1.0 s and TTFB 50–70 ms, so the gap is JavaScript, see "Open" |
| 360 / 390 / 430 / 768 px: tap targets ≥ 44 px, no horizontal scroll, safe areas, menu focus trap | ✅ |
| Keyboard + screen reader: skip link, landmarks, focus ring, alt text | ✅ |

## Fixed in this pass

| Finding | Where | Fix |
|---|---|---|
| Small red labels (11 px mono) at **3.2:1** on ink, 3.0:1 on onyx (AA needs 4.5:1) | every eyebrow / numbered label | New `--signal-red` `#F23A45` (5.1:1 ink, 4.9:1 onyx), applied by one global rule to `.label.text-red` on dark tones. The paper tone keeps cinema red (5.7:1 there) |
| /about scrolled **41 px** sideways at 360 px (11 px at 390) | `ClientList` | Names were adjacent `<span>`s with no whitespace, so each group became one unbreakable "word". Now each name + separator is `nowrap`, with a real space between items. Separators are `aria-hidden` |
| FAQ `<dl>` held a number `<span>` and a wrapper `<div>`, and `<dt>` contained an `<h3>` (invalid) | `Faq` | Question `<h3>` + answer `<p>` (keeps the heading structure search and AI read) |
| Play button's accessible name didn't contain its visible text | `FilmPlayer` | `aria-label="Play film · 0:20: Résonance"` |
| Mobile menu didn't trap focus: Tab and screen readers reached the page behind | `MobileMenu` | Everything outside the menu is `inert` while it's open; Escape returns focus to the toggle (tested) |
| Tap targets under 44 px: text links (21 px), wordmark (16 px), breadcrumb (14 px), footer icons (14 px wide), filter chips (40 px), contact links (31–40 px), tablet nav (15 px) | site-wide | `hit-44` / `.link-cut::before`: an invisible pseudo-element pads the target to 44 px without moving anything. Chips use `min-h-11`; footer icons `min-w-11` |
| Above-the-fold LCP images hidden behind the `wipe` reveal and missing priority hints (/about portrait, /work first card); this broke the AGENTS rule | `Bio`, `WorkGrid` | `SectionRenderer` passes `position`, and `isAboveFold` (positions 0–1) drops the wipe and adds `preload` + `fetchPriority="high"` |
| Focus ring 1 px cinema red (3.2:1) | `globals.css` | 2 px signal red (5.1:1 on ink; ≥ 3:1 on paper for non-text contrast) |
| `robots.txt` had `Host: https://…` (invalid, so SEO dropped to 92) | `app/robots.ts` | Removed (Google ignores `Host`) |
| **Production served a stale `globals.css`**, so none of the CSS fixes shipped on the first deploy | build | Vercel restores `.next/cache` and the Tailwind Turbopack loader doesn't invalidate under it. `turbopackFileSystemCacheForBuild: false` (compiling takes ~7 s) |
| Admin media search had no label | `MediaPicker` | `aria-label="Search media"` |
| Fonts fetched from Google at build time | `app/layout.tsx` | `next/font/local` with Latin WOFF2 committed in `src/app/fonts` (OFL) |
| Share cards: none on home/work/about/contact; the project card was a 686 KB PNG that took ~7 s per crawler hit | OG images | Site card + project cards render to ~50 KB JPEG (under WhatsApp's ~300 KB limit), inputs cached, ~0.1 s warm |

Verified at 360 / 390 / 430 / 768 px (every public page in an iframe of that width, reveals forced on):
- no horizontal overflow;
- every interactive element's effective target is ≥ 44 px tall (inline links inside paragraphs are exempt, per WCAG 2.5.8);
- safe areas: header `env(safe-area-inset-top)`, footer, mobile menu and WhatsApp button `env(safe-area-inset-bottom)`, `viewport-fit=cover`.

## Open (needs a decision)

1. **Home LCP 3.1 s / Performance 93–94.** The hero still is tiny (6 KB at 750w) and preloaded, yet its render delay is ~0.8 s. The CUTLINE-style intro overlay plays over the hero on a first visit, and home ships Lenis and the intro controller. Options:
   - **a)** keep the intro and accept ~94 on home;
   - **b)** show the intro only from the second page view, or only on desktop;
   - **c)** shorten it to under ~1 s.
   Recommendation: **(c)**, since it keeps the moment and should clear 95.
2. **LCP budget 1.8 s (lab) is not met on any page (2.5–2.7 s).** In the trace, first paint and LCP land together just as the JS finishes. Lighthouse's simulation charges all ~180–190 KB of gzipped JS (≈135 KB is the shared React 19 + Next 16 runtime) to LCP on a 4× slower CPU. Levers, smallest first:
   - **a)** a modern `browserslist` (Safari ≥ 16.4) removes ~14 KB of legacy transforms that Lighthouse flags on every page. This is a support-policy call;
   - **b)** find the ~28 KB of unused JS in the main shared chunk;
   - **c)** load Speed Insights after `load`.
   - Tried and rejected: `experimental.inlineCss`. It removed the 2 CSS requests but LCP didn't move, and the HTML doubled (+24 KB gz per page).
   - Real-device field data (Speed Insights) is the deciding number. The lab's slow-4G profile is harsher than a mid-range Android on real 4G.
3. **Lighthouse CI on protected previews**: to audit previews behind Deployment Protection, either make previews public or add an *ephemeral* bypass that never reaches the uploaded reports.

## How to re-run

```bash
pnpm dlx lighthouse@12.8.2 https://ashyan-portfolio.vercel.app/ --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate --view
```

Don't audit `next start` locally for numbers: TTFB, CDN caching, and missing `/_vercel/*` scripts make it meaningless. Use a deployment (CI does this automatically).
