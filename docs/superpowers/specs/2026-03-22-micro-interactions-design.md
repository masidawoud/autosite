# Micro-interactions & Scroll Animations Design

**Date:** 2026-03-22
**Status:** Approved

---

## Goal

Give AutoSite-generated dental practice sites a premium, crafted feel through subtle, purposeful motion — scroll-triggered reveals, load-time hero entrances, and a responsive nav — without adding any dependency to the build pipeline.

---

## Approach

Vanilla CSS animations + a single `IntersectionObserver` script. No library, no npm dependency, no CDN. The observer is universal (~15 lines JS); the animation feel is controlled entirely by CSS custom properties injected from `theme.json`.

---

## Core Mechanism

### 1. CSS custom properties (from `theme.json`)

Each theme preset gains an `animation` block:

```json
"animation": {
  "duration": "400ms",
  "easing": "ease-out",
  "distance": "16px"
}
```

`Layout.astro` injects these alongside the existing theme vars using optional chaining so old theme files degrade gracefully without crashing the build:

```js
const cssVars = `
  /* ...existing vars... */
  --anim-duration: ${theme.animation?.duration ?? '400ms'};
  --anim-easing:   ${theme.animation?.easing   ?? 'ease-out'};
  --anim-distance: ${theme.animation?.distance  ?? '16px'};
`.trim();
```

All CSS references also include inline fallbacks (`var(--anim-duration, 400ms)`) so existing `builds/` directories with old `theme.json` files continue to work without a rebuild.

**Build pipeline note:** `build-sites.js` already copies the full theme preset into the active `theme.json`. No changes to `build-sites.js` are required.

### 2. No-JS guard

Before the observer script runs, `[data-animate]` elements must be visible to users with JavaScript disabled. JS adds a `js` class to `<html>`, and `opacity: 0` is only applied when `.js` is present. Without JS, all elements remain visible.

In `Layout.astro`, immediately after `<body>` opens, add a synchronous inline script using Astro's `is:inline` directive (prevents Astro from bundling or deferring it):

```astro
<script is:inline>document.documentElement.classList.add('js');</script>
```

All animation CSS selectors use `.js [data-animate]` rather than bare `[data-animate]`.

### 3. Global animation CSS (in `Layout.astro` `<style is:global>`)

```css
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(var(--anim-distance, 16px));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Observer-driven reveals */
.js [data-animate] {
  opacity: 0;
  transform: translateY(var(--anim-distance, 16px));
  transition:
    opacity var(--anim-duration, 400ms) var(--anim-easing, ease-out),
    transform var(--anim-duration, 400ms) var(--anim-easing, ease-out);
}

.js [data-animate].is-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Hero load-time entrance — also gated on .js so no-JS users see hero text */
.js .hero__title {
  animation: fadeUp var(--anim-duration, 400ms) var(--anim-easing, ease-out) both;
}
.js .hero__desc {
  animation: fadeUp var(--anim-duration, 400ms) var(--anim-easing, ease-out) 100ms both;
}
.js .hero__actions {
  animation: fadeUp var(--anim-duration, 400ms) var(--anim-easing, ease-out) 200ms both;
}

/* Stagger — scoped to specific list/grid containers; lives here in global CSS
   (Astro scoped styles cannot match [data-animate] attributes in foreign components) */
.services__list [data-animate]:nth-child(2),
.reviews__grid  [data-animate]:nth-child(2) { transition-delay: 80ms; }

.services__list [data-animate]:nth-child(3),
.reviews__grid  [data-animate]:nth-child(3) { transition-delay: 160ms; }

.services__list [data-animate]:nth-child(4),
.reviews__grid  [data-animate]:nth-child(4) { transition-delay: 240ms; }

/* Features list items stagger (scoped to .features__list, not .features__grid) */
.features__list [data-animate]:nth-child(2) { transition-delay: 80ms; }
.features__list [data-animate]:nth-child(3) { transition-delay: 160ms; }
.features__list [data-animate]:nth-child(4) { transition-delay: 240ms; }

@media (prefers-reduced-motion: reduce) {
  .js [data-animate] {
    opacity: 1;
    transform: none;
    transition: none;
  }
  .js .hero__title,
  .js .hero__desc,
  .js .hero__actions {
    animation: none !important;
  }
}
```

`animation-fill-mode: both` on hero elements keeps them invisible during the stagger delay and holds the final state afterward. Without it, elements flash at full opacity before the animation begins.

### 4. IntersectionObserver script (in `Layout.astro`)

Use a bare `<script>` tag (not `is:inline`). Astro bundles it as a deferred ES module that runs after `DOMContentLoaded`. `IntersectionObserver` fires its callback immediately on the first tick for any element already in the viewport at observation time, so above-fold elements will still receive `.is-visible` without a flash.

```astro
<script>
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  document
    .querySelectorAll('[data-animate]:not([data-animate="false"])')
    .forEach((el) => observer.observe(el));
</script>
```

### 5. Nav scroll shadow — already implemented

`Nav.astro` already has a scroll listener toggling `.nav--scrolled` on `<header class="nav" id="nav">` with transitions on background, box-shadow, and padding. **No changes needed.**

---

## Per-component Animations

### Hero

The hero section is always above the fold. Its entrance animation is defined entirely in `Layout.astro` global CSS (gated on `.js`) targeting the actual existing class names: `.hero__title`, `.hero__desc`, `.hero__actions`. No changes to `Hero.astro` markup are needed — only the global CSS additions above.

### Services

Cards are `.service-card` elements inside `.services__list` (confirmed from `Services.astro`). Add `data-animate` to each `.service-card` element. Stagger is handled by the global CSS above.

### Features

`Features.astro` is a two-column layout: `.features__image-col` and `.features__text-col` inside `.features__grid`. Feature items are `.feature-item` inside `.features__list` inside `.features__text-col`.

- `features__image-col`: add `data-animate`
- `features__text-col`: add `data-animate` + `style="transition-delay: 120ms"` inline so it reveals slightly after the image column. The inline style intentionally overrides the CSS-level default (0ms delay for first children). The `prefers-reduced-motion` block sets `transition: none` which suppresses the transition regardless of any delay value, so no extra override is needed there.
- Each `.feature-item` inside `.features__list`: add `data-animate`; stagger handled by global `.features__list [data-animate]:nth-child(n)` rules

### Reviews

Cards are `.review-card` elements inside `.reviews__grid`. Add `data-animate` to each `.review-card`. Stagger handled by the global CSS above.

### About, Quote, OpeningHours, Vergoeding, Contact — section reveal

Section heading and content block each get `data-animate`. They animate together (no stagger).

### Footer — no animation

Excluded.

---

## Stagger cap

Stagger CSS covers `:nth-child(2)` through `:nth-child(4)`. Dental practice sites typically have 3–4 cards/items per section. Items beyond the 4th animate simultaneously with no additional delay — intentional and acceptable.

---

## Theme Preset Tuning

| Preset | Duration | Easing | Distance | Feel |
|---|---|---|---|---|
| `warm-editorial` | 600ms | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | 20px | Languid, editorial |
| `ocean-depths` | 450ms | `ease-out` | 16px | Calm, measured |
| `tech-innovation` | 250ms | `cubic-bezier(0.16, 1, 0.3, 1)` | 12px | Snappy, precise |

---

## Scope of Changes

| File | Change |
|---|---|
| `dental-template/src/layouts/Layout.astro` | Add animation CSS vars to `cssVars`; add `<script is:inline>` JS guard; add global animation CSS (keyframe, observer reveals, hero entrance, stagger rules, `prefers-reduced-motion`); add observer `<script>` |
| `dental-template/src/data/themes/warm-editorial.json` | Add `animation` block |
| `dental-template/src/data/themes/ocean-depths.json` | Add `animation` block |
| `dental-template/src/data/themes/tech-innovation.json` | Add `animation` block |
| `dental-template/src/components/Services.astro` | Add `data-animate` to card elements within `.services__list` |
| `dental-template/src/components/Features.astro` | Add `data-animate` to `features__image-col`, `features__text-col` (with `style="transition-delay:120ms"`), and each `.feature-item` |
| `dental-template/src/components/Reviews.astro` | Add `data-animate` to each `.review-card` within `.reviews__grid` |
| `dental-template/src/components/About.astro` | Add `data-animate` to heading + content block |
| `dental-template/src/components/Quote.astro` | Add `data-animate` to heading + content block |
| `dental-template/src/components/OpeningHours.astro` | Add `data-animate` to heading + content block |
| `dental-template/src/components/Vergoeding.astro` | Add `data-animate` to heading + content block |
| `dental-template/src/components/Contact.astro` | Add `data-animate` to heading + content block |

No changes to `build-sites.js`, `Hero.astro`, `Nav.astro`, `site.json`, `prospects.csv`, or deployment pipeline.

---

## Multi-template Scalability

- New templates inherit the system via `Layout.astro`
- Per-element opt-out: omit `data-animate` or set `data-animate="false"` (excluded by `[data-animate]:not([data-animate="false"])`)
- Per-theme feel: tune the `animation` block in the theme preset JSON
- No per-template duplication required

---

## Constraints & Non-goals

- No external library or CDN dependency
- No changes to build or deployment pipeline
- Only `opacity` and `transform` animated — no layout-affecting properties (GPU compositing only)
- `prefers-reduced-motion` respected for both transitions and hero keyframe animations
- No-JS: all elements visible without JavaScript (`.js` class guard)
