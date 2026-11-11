# 01 · Design direction — "Final Cut"

Client: **Ashyan Zafar**, film editor. Brief: luxury, cinematic, **black · white · red**, and a UI good enough to be the selling point.

## What we took from each reference (reviewed in the browser on 2026-11-11)

| Reference | What the client pointed at | What we take | What we leave |
|---|---|---|---|
| **Nick Clement** — nickclement.com | Rotating client logos | Slow, continuous logo marquee. Logos are white marks on dark rounded tiles (≈ 130×90), edges fade out. → `ClientMarquee` | The 1-col product-design layout |
| **Taha Seder** — tahaseder.com | Fonts | **Instrument Serif** for huge display type (tight −3.5% tracking, italic accent word in colour). **JetBrains Mono** for tiny uppercase labels with wide tracking. **Geist** for body text. Also: numbered nav (`01 WORK`), the `REC · 24 FPS` and live-clock details | His orange accent |
| **Moodboard** — `assets/Cinematic Film Editor Portfolio.png` | "Something I found interesting" (already uses Ashyan's name) | The page structure: dark hero with a portrait and serif headline, then a work grid (2 wide + 3 narrow; we render it on **black**, since the ivory version clashed with black/white/red), then an image / about / capabilities / let's-talk row on white paper, then a dark footer | Its beige/sepia palette, which becomes ivory + red |
| **CUTLINE** — cutline.in ("CUTLINE \| Visual Post-Production Studio") | First page | The **intro / first screen**: a full-viewport black hero whose backdrop is a blurred, grayscale, vignetted screenshot of an NLE timeline (clips, waveforms, a thin playhead). After ~2s a huge wordmark assembles in the centre: "Cut \| Line", where the "t" is a blade, red dots act as accents and a vertical cut line splits the two words. "VISUAL" sits below in red spaced caps, with an italic tagline ("Edit With Precision. Create with Soul.") and a red bouncing "Scroll to explore" chevron. Header has a pulsing location dot. Work thumbnails are `grayscale(1)` and numbered "01 · MUMBAI / VISUALS". → We use this as our **intro sequence** (see "Intro" below) | Inter Black italic caps, orange accent, the carousel |
| **Mario Monteiro** — mariomonteiro.tv | "Perfect visual example, but not the font and colours" | Page flow: hero → client strip with hairlines → Featured Work 3-col grid with fade-up reveals → mixed-type manifesto (*serif italic* + SANS CAPS) → centred "Let's craft something together" CTA with email + arrow → footer | Syne wide display font and the orange/black palette |
| **Zylitch** — zylitch-next.vercel.app | Cursor: "instead of a square I want a blade" | A custom cursor that follows movement direction (theirs is a paw trail using `atan2`). Ours is a **blade**: a scalpel that tilts with mouse speed, a red slash on click, and a PLAY ring over video cards. → `BladeCursor` | The pink theme and the cat |

## Intro (from CUTLINE)

The first screen plays a short "edit" before revealing the hero. It takes under 1.6s, never blocks LCP (the hero image paints underneath), runs only once per session, and is skippable on scroll, click or key.

1. Black screen with a blurred, grayscale **timeline backdrop** (a still of Ashyan's real edit timeline: clips, waveforms) at about 25% opacity with a heavy vignette.
2. A red **playhead** sweeps left to right across it, with a running timecode.
3. As it passes, the name **ASHYAN | ZAFAR** is "cut" in: the two words slide in from either side of a thin vertical cut line. Instrument Serif, with a red dot accent and "FILM EDITOR" in red mono caps underneath.
4. Hard cut (one frame of black), then the hero is revealed. The header's REC dot keeps pulsing.

On mobile the playhead sweeps top to bottom and the name stacks. Under reduced motion it's a static frame that fades in 200ms. Tracked in issue #18.

## Palette

Luxury here means restraint. The page is mostly black, with ivory sections for rhythm, and red is a rare signal: under 5% of any screen.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#0A0A0A` | Page background |
| `onyx` | `#111111` | Cards, marquee tiles |
| `graphite` | `#1C1C1C` | Hover surfaces, admin inputs |
| `ivory` | `#F4F1EC` | Primary text on black, background of "paper" sections |
| `bone` | `#E9E4DC` | Secondary paper surface |
| `smoke` | `#8C8984` | Muted text and labels |
| `red` (Cinema Red) | `#C1121F` | Italic accent words, REC dot, playhead, focus ring, selection |
| `red-bright` | `#E3202D` | Hover/active red, errors |
| `oxblood` | `#5C0A10` | Gradients and glows only |

Sections take `tone="ink" | "paper"`. The `.tone-paper` class flips the semantic tokens, so any component works on either tone.

## Typography

| Role | Font | Notes |
|---|---|---|
| Display / headings | Instrument Serif 400 + italic | `text-display` uses `clamp(3.25rem → 11rem)`, line-height 0.9, tracking −0.035em |
| Body / UI | Geist | 15–16px, relaxed leading |
| Labels / meta / timecode | JetBrains Mono 400/500 | `.label` = 11px, uppercase, 0.18em tracking |

Editors write headlines with `*italic red*` and `**SANS CAPS**`. `RichText` renders this markup, so no HTML is ever stored.

## Motion principles

- **Editing grammar**: cuts, wipes, playheads and timecode. `ease-cut` (`cubic-bezier(.77,0,.175,1)`) for wipes, `ease-out-expo` for reveals.
- Hover on a work card plays a red playhead sweep, a slow 1.04 zoom and the cursor's PLAY ring. Later the card also plays a muted Mux loop.
- Section reveals: fade up 24px, staggered by 60ms, once only. Use `motion` for these, lazily imported, only where it adds something.
- Smooth scroll (Lenis) on desktop only. Native scroll on touch.
- `prefers-reduced-motion` turns off the marquee, cursor, timecode and reveals.

## Mobile pathways (designed mobile-first)

| Area | Phone (< 640) | Tablet (640–1023) | Desktop (≥ 1024) |
|---|---|---|---|
| Header | Name + "Menu". Full-screen serif menu with 64px rows and safe-area padding | Same as phone | Numbered inline nav |
| Hero | Image fills the top, headline sits over a bottom fade, `92svh` | `100svh`, image on the right | Split: type left, portrait right at 62% |
| Client marquee | Small tiles (112×64), slower | Medium tiles | 176×96 tiles |
| Work grid | 1 column, 4:3 cards; filter chips scroll sideways | 2 columns, 16:9 | 2 wide + 3 narrow (6-col grid) |
| Video | Poster only. The loop plays only while the card is in view; one video at a time | Same | Loop plays on hover |
| About | Image, then text, then capabilities, stacked | Image beside text | 3 columns |
| Cursor | Off (touch) | Off unless a mouse or trackpad is used | Blade |
| Tap targets | ≥ 44px (`min-h-11`) everywhere | — | — |

Use `svh`/`dvh` instead of `vh`. Never let the page scroll sideways; the marquee and chips clip inside their own containers. To test phone widths when the browser window can't be resized, load the site in 390px-wide iframes (see AGENTS.md).

## Component inventory

Built: `Hero`, `ClientMarquee`, `WorkGrid`/`WorkCard`, `Statement`, `About`, `ContactCta`, `SiteHeader`, `MobileMenu`, `SiteFooter`, `BladeCursor`, `Timecode`, `RichText`.
Next: `VideoLoop` (Mux, in-view play), `FilmPlayer` (lazy mux-player in a modal/page), `ProjectHero`, `CreditsList`, `ProjectNav` (prev/next), `Reveal`, `ContactForm`, `ShowreelSection`, `TestimonialSection`, `Preloader` (a short "slate" count-in, first visit only, under 900ms).
