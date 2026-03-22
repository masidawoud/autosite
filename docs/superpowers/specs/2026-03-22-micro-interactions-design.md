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

`Layout.astro` injects these as CSS variables alongside the existing theme vars:

```css
--anim-duration: 400ms;
--anim-easing: ease-out;
--anim-distance: 16px;
```

### 2. Base animation CSS (in `Layout.astro` global styles)

```css
[data-animate] {
  opacity: 0;
  transform: translateY(var(--anim-distance));
  transition:
    opacity var(--anim-duration) var(--anim-easing),
    transform var(--anim-duration) var(--anim-easing);
}

[data-animate].is-visible {
  opacity: 1;
  transform: translateY(0);
}
```

### 3. IntersectionObserver script (in `Layout.astro`)

```js
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

  document.querySelectorAll('[data-animate]').forEach((el) => observer.observe(el));
</script>
```

### 4. Nav scroll shadow (separate scroll listener)

```js
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });
```

```css
nav.scrolled {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: box-shadow 300ms ease;
}
```

---

## Per-component Animations

### Hero — load-time entrance (CSS `@keyframes`, no observer)

The hero heading, subtext, and CTA fade up on page load using CSS keyframes with staggered `animation-delay`. No observer needed since the hero is always above the fold.

### Nav — scroll shadow

Box-shadow fades in when the user scrolls past 50px (scroll listener above). Reinforces sticky nav position without being distracting.

### Services, Features, Reviews — staggered card reveal

Each card/item gets `data-animate`. Stagger is achieved via CSS `transition-delay` on `nth-child`:

```css
[data-animate]:nth-child(2) { transition-delay: 80ms; }
[data-animate]:nth-child(3) { transition-delay: 160ms; }
[data-animate]:nth-child(4) { transition-delay: 240ms; }
```

### About, Quote, OpeningHours, Vergoeding, Contact — section reveal

Section heading and content block each get `data-animate`. They animate together (no stagger needed).

### Footer — no animation

Animating a footer is distracting and adds no perceived quality. Excluded.

---

## Theme Preset Tuning

Each preset expresses a distinct animation personality:

| Preset | Duration | Easing | Distance | Feel |
|---|---|---|---|---|
| `warm-editorial` | 600ms | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | 20px | Languid, editorial |
| `ocean-depths` | 450ms | `ease-out` | 16px | Calm, measured |
| `tech-innovation` | 250ms | `cubic-bezier(0.16, 1, 0.3, 1)` | 12px | Snappy, precise |

---

## Scope of Changes

| File | Change |
|---|---|
| `dental-template/src/layouts/Layout.astro` | Add CSS vars injection, base animation CSS, observer script, nav scroll listener |
| `dental-template/src/data/themes/*.json` | Add `animation` block to each theme preset |
| `dental-template/src/components/*.astro` | Add `data-animate` attributes to appropriate elements |

No changes to `build-sites.js`, `site.json`, `prospects.csv`, or deployment pipeline.

---

## Multi-template Scalability

- New templates inherit the system automatically via `Layout.astro`
- Per-element opt-out: add `data-animate="false"` or simply omit the attribute
- Per-theme feel: tune the `animation` block in `theme.json`
- No per-template duplication required

---

## Constraints & Non-goals

- No external library or CDN dependency
- No changes to the build or deployment pipeline
- No animations that affect layout (no width/height transitions — only opacity and transform for GPU compositing)
- `prefers-reduced-motion` must be respected:

```css
@media (prefers-reduced-motion: reduce) {
  [data-animate] {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```
