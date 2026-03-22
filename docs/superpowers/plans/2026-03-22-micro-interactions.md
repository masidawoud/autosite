# Micro-interactions & Scroll Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add premium scroll-triggered reveal animations and a hero entrance animation to the dental template without touching the build pipeline.

**Architecture:** A single `IntersectionObserver` script in `Layout.astro` adds `.is-visible` to elements with `data-animate`. All animation CSS lives in `Layout.astro`'s global style block, controlled via CSS custom properties from `theme.json`. Hero elements animate via CSS keyframes on page load. No external libraries.

**Tech Stack:** Astro 4.x, vanilla JS, CSS custom properties, CSS keyframes, `IntersectionObserver`

---

## File Map

| File | What changes |
|---|---|
| `dental-template/src/layouts/Layout.astro` | CSS vars injection, JS guard, global animation CSS, observer script |
| `dental-template/src/data/themes/warm-editorial.json` | Add `animation` block |
| `dental-template/src/data/themes/ocean-depths.json` | Add `animation` block |
| `dental-template/src/data/themes/tech-innovation.json` | Add `animation` block |
| `dental-template/src/components/Services.astro` | Add `data-animate` to `.service-card` elements |
| `dental-template/src/components/Features.astro` | Add `data-animate` to columns and `.feature-item` elements |
| `dental-template/src/components/Reviews.astro` | Add `data-animate` to `.review-card` elements |
| `dental-template/src/components/About.astro` | Add `data-animate` to header + team grid |
| `dental-template/src/components/Quote.astro` | Add `data-animate` to quote block |
| `dental-template/src/components/OpeningHours.astro` | Add `data-animate` to info + table columns |
| `dental-template/src/components/Vergoeding.astro` | Add `data-animate` to content + insurers columns |
| `dental-template/src/components/Contact.astro` | Add `data-animate` to info + form columns |

---

## Task 1: Add `animation` block to all three theme presets

**Files:**
- Modify: `dental-template/src/data/themes/warm-editorial.json`
- Modify: `dental-template/src/data/themes/ocean-depths.json`
- Modify: `dental-template/src/data/themes/tech-innovation.json`

Each file is a JSON object. Add an `"animation"` key at the top level (alongside `"colors"`, `"fonts"`, `"radius"`).

- [ ] **Step 1: Add animation block to warm-editorial.json**

Open `dental-template/src/data/themes/warm-editorial.json`. Add at the end of the root object (before the closing `}`):

```json
"animation": {
  "duration": "600ms",
  "easing": "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  "distance": "20px"
}
```

- [ ] **Step 2: Add animation block to ocean-depths.json**

Open `dental-template/src/data/themes/ocean-depths.json`. Add:

```json
"animation": {
  "duration": "450ms",
  "easing": "ease-out",
  "distance": "16px"
}
```

- [ ] **Step 3: Add animation block to tech-innovation.json**

Open `dental-template/src/data/themes/tech-innovation.json`. Add:

```json
"animation": {
  "duration": "250ms",
  "easing": "cubic-bezier(0.16, 1, 0.3, 1)",
  "distance": "12px"
}
```

- [ ] **Step 4: Commit**

```bash
git add dental-template/src/data/themes/
git commit -m "feat: add animation tokens to all theme presets"
```

---

## Task 2: Add animation CSS vars to Layout.astro

**Files:**
- Modify: `dental-template/src/layouts/Layout.astro` (the `cssVars` template literal, lines ~14–32)

The `cssVars` string is built in the frontmatter and injected as `:root { ... }`. Add the three animation vars at the end of the existing string, using optional chaining so old `theme.json` files without the `animation` key don't crash the build.

- [ ] **Step 1: Add vars to the cssVars string**

In `dental-template/src/layouts/Layout.astro`, find the `cssVars` template literal and add three lines before `.trim()`:

```js
const cssVars = `
  --font-display: '${theme.fonts.display_family}', ${theme.fonts.display_fallback};
  --font-body: '${theme.fonts.body_family}', ${theme.fonts.body_fallback};
  --color-accent:       ${theme.colors.accent};
  --color-accent-hover: ${theme.colors.accent_hover};
  --color-accent-light: ${theme.colors.accent_light};
  --color-bg:           ${theme.colors.bg};
  --color-bg-alt:       ${theme.colors.bg_alt};
  --color-bg-dark:      ${theme.colors.bg_dark};
  --color-text:         ${theme.colors.text};
  --color-text-muted:   ${theme.colors.text_muted};
  --color-text-light:   ${theme.colors.text_light};
  --color-border:       ${theme.colors.border};
  --color-star:         ${theme.colors.star};
  --radius-sm:          ${theme.radius.sm};
  --radius-md:          ${theme.radius.md};
  --radius-lg:          ${theme.radius.lg};
  --radius-xl:          ${theme.radius.xl};
  --anim-duration: ${theme.animation?.duration ?? '400ms'};
  --anim-easing:   ${theme.animation?.easing   ?? 'ease-out'};
  --anim-distance: ${theme.animation?.distance  ?? '16px'};
`.trim();
```

- [ ] **Step 2: Verify the dev server starts without errors**

```bash
cd dental-template && npm run dev
```

Expected: dev server starts, no TypeScript or runtime errors in terminal.

- [ ] **Step 3: Verify CSS vars are injected**

Open browser devtools → Elements → `<head>` → find the `<style>` tag with `:root { ... }`. Confirm `--anim-duration`, `--anim-easing`, `--anim-distance` are present with the correct values for the active theme.

- [ ] **Step 4: Commit**

```bash
git add dental-template/src/layouts/Layout.astro
git commit -m "feat: inject animation CSS vars from theme.json into Layout.astro"
```

---

## Task 3: Add JS guard, global animation CSS, and observer script to Layout.astro

**Files:**
- Modify: `dental-template/src/layouts/Layout.astro` (body opening tag, `<style is:global>` block, end of body)

This is the core of the animation system. Three additions in one task since they are tightly coupled and must work together.

**Background — how this works:**

- A `<script is:inline>` immediately after `<body>` adds class `js` to `<html>`. This is synchronous — it runs before any content renders. All animation CSS is scoped to `.js`, so without JavaScript, all elements are visible at all times.
- The `<style is:global>` additions define the `fadeUp` keyframe, the hidden/visible states for `[data-animate]` elements, the hero entrance animations, and stagger delays for card grids.
- The observer `<script>` (not `is:inline` — Astro bundles this as a deferred ES module) wires up `IntersectionObserver` to add `.is-visible` to every `[data-animate]` element when it enters the viewport. `IntersectionObserver` fires immediately for elements already visible at observation time, so above-fold elements are handled correctly.

- [ ] **Step 1: Add the JS guard script immediately after `<body>` opens**

In `Layout.astro`, the `<body>` currently looks like:

```astro
  <body>
    <slot />
  </body>
```

Change it to:

```astro
  <body>
    <script is:inline>document.documentElement.classList.add('js');</script>
    <slot />
  </body>
```

- [ ] **Step 2: Add animation CSS to the `<style is:global>` block**

At the end of the existing `<style is:global>` block (after the `.divider` rule, before `</style>`), add:

```css
/* ===========================
   Animations
=========================== */

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

/* Observer-driven scroll reveals */
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

/* Hero load-time entrance — gated on .js so no-JS users see text immediately */
.js .hero__title {
  animation: fadeUp var(--anim-duration, 400ms) var(--anim-easing, ease-out) both;
}
.js .hero__desc {
  animation: fadeUp var(--anim-duration, 400ms) var(--anim-easing, ease-out) 100ms both;
}
.js .hero__actions {
  animation: fadeUp var(--anim-duration, 400ms) var(--anim-easing, ease-out) 200ms both;
}

/* Stagger delays — scoped to grid/list containers so they don't leak to unrelated siblings.
   Lives in global CSS because Astro scoped styles can't match [data-animate] in foreign components. */
.services__list [data-animate]:nth-child(2),
.reviews__grid  [data-animate]:nth-child(2) { transition-delay: 80ms; }

.services__list [data-animate]:nth-child(3),
.reviews__grid  [data-animate]:nth-child(3) { transition-delay: 160ms; }

.services__list [data-animate]:nth-child(4),
.reviews__grid  [data-animate]:nth-child(4) { transition-delay: 240ms; }

.features__list [data-animate]:nth-child(2) { transition-delay: 80ms; }
.features__list [data-animate]:nth-child(3) { transition-delay: 160ms; }
.features__list [data-animate]:nth-child(4) { transition-delay: 240ms; }

/* Accessibility */
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

- [ ] **Step 3: Add the IntersectionObserver script before `</body>`**

```astro
  <body>
    <script is:inline>document.documentElement.classList.add('js');</script>
    <slot />
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
  </body>
```

- [ ] **Step 4: Verify in the dev server**

```bash
cd dental-template && npm run dev
```

Expected:
- Page loads with no JS errors in browser console
- `<html>` has class `js`
- Hero heading, description, and CTA fade up on page load
- Disabling JS in browser devtools → reload: all content is immediately visible (no opacity:0 elements)
- Setting `prefers-reduced-motion: reduce` in devtools → no animations fire

- [ ] **Step 5: Commit**

```bash
git add dental-template/src/layouts/Layout.astro
git commit -m "feat: add scroll animation system to Layout.astro (observer, hero, stagger CSS)"
```

---

## Task 4: Add data-animate to Services.astro

**Files:**
- Modify: `dental-template/src/components/Services.astro`

Cards are `.service-card` elements rendered inside `.services__list` via `data.items.map(...)`. Add `data-animate` to each card's root div.

- [ ] **Step 1: Add data-animate to service cards**

In `Services.astro`, find the `.service-card` div inside the map. The current line looks like:

```astro
<div class={`service-card ${i % 2 !== 0 ? 'service-card--flipped' : ''}`}>
```

Change it to:

```astro
<div class={`service-card ${i % 2 !== 0 ? 'service-card--flipped' : ''}`} data-animate>
```

- [ ] **Step 2: Verify in dev server**

Scroll down to the Services section. Cards should fade up one at a time with stagger. On first load when cards are already in view, they should appear normally (observer fires immediately).

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/Services.astro
git commit -m "feat: add scroll reveal to Services cards"
```

---

## Task 5: Add data-animate to Features.astro

**Files:**
- Modify: `dental-template/src/components/Features.astro`

`Features.astro` is a two-column layout: image column (`features__image-col`) and text column (`features__text-col`) are direct children of `features__grid`. Feature items (`.feature-item`) are inside `.features__list` inside the text column.

Strategy:
- Image column: `data-animate` (fades in first)
- Text column: `data-animate` + `style="transition-delay: 120ms"` (fades in slightly after)
- Each `.feature-item`: `data-animate` (stagger via `.features__list [data-animate]:nth-child(n)` global CSS)

- [ ] **Step 1: Add data-animate to image and text columns**

Find the two column divs in `Features.astro`:

```astro
<div class="features__image-col">
```
becomes:
```astro
<div class="features__image-col" data-animate>
```

```astro
<div class="features__text-col">
```
becomes:
```astro
<div class="features__text-col" data-animate style="transition-delay: 120ms">
```

- [ ] **Step 2: Add data-animate to each feature item**

Inside the `data.items.map(...)`, the `.feature-item` div:

```astro
<div class="feature-item">
```
becomes:
```astro
<div class="feature-item" data-animate>
```

- [ ] **Step 3: Verify in dev server**

Scroll to the Features section. Image column fades in, text column follows 120ms later, then feature list items cascade down with stagger.

- [ ] **Step 4: Commit**

```bash
git add dental-template/src/components/Features.astro
git commit -m "feat: add scroll reveal to Features section"
```

---

## Task 6: Add data-animate to Reviews.astro

**Files:**
- Modify: `dental-template/src/components/Reviews.astro`

Cards are `.review-card` elements inside `.reviews__grid`.

- [ ] **Step 1: Add data-animate to review cards**

Find the `.review-card` div inside the `data.items.map(...)`:

```astro
<div class="review-card">
```
becomes:
```astro
<div class="review-card" data-animate>
```

- [ ] **Step 2: Verify in dev server**

Scroll to the Reviews section. Cards stagger in.

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/Reviews.astro
git commit -m "feat: add scroll reveal to Reviews cards"
```

---

## Task 7: Add data-animate to About.astro

**Files:**
- Modify: `dental-template/src/components/About.astro`

The section has `.about__header` (eyebrow + h2) and `.team-grid` (team cards) as the two main content blocks. Both get `data-animate`.

- [ ] **Step 1: Add data-animate to header and team grid**

```astro
<div class="about__header">
```
becomes:
```astro
<div class="about__header" data-animate>
```

```astro
<div class="team-grid">
```
becomes:
```astro
<div class="team-grid" data-animate>
```

- [ ] **Step 2: Verify in dev server**

Scroll to the About/Team section. Header fades in, then the team grid block fades in.

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/About.astro
git commit -m "feat: add scroll reveal to About section"
```

---

## Task 8: Add data-animate to Quote.astro

**Files:**
- Modify: `dental-template/src/components/Quote.astro`

The entire quote lives in `.quote-inner`. A single `data-animate` on that wrapper is sufficient.

- [ ] **Step 1: Add data-animate to quote inner**

```astro
<div class="container--narrow quote-inner">
```
becomes:
```astro
<div class="container--narrow quote-inner" data-animate>
```

- [ ] **Step 2: Verify in dev server**

Scroll to the Quote section. Entire quote block fades up.

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/Quote.astro
git commit -m "feat: add scroll reveal to Quote section"
```

---

## Task 9: Add data-animate to OpeningHours.astro

**Files:**
- Modify: `dental-template/src/components/OpeningHours.astro`

The section has `.hours__info` (left: title + contacts) and `.hours__table-wrapper` (right: opening hours table) as direct children of `.hours__grid`.

- [ ] **Step 1: Add data-animate to both columns**

```astro
<div class="hours__info">
```
becomes:
```astro
<div class="hours__info" data-animate>
```

```astro
<div class="hours__table-wrapper">
```
becomes:
```astro
<div class="hours__table-wrapper" data-animate>
```

- [ ] **Step 2: Verify in dev server**

Scroll to Opening Hours. Both columns fade up together.

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/OpeningHours.astro
git commit -m "feat: add scroll reveal to OpeningHours section"
```

---

## Task 10: Add data-animate to Vergoeding.astro

**Files:**
- Modify: `dental-template/src/components/Vergoeding.astro`

`.vergoeding__content` (left) and `.vergoeding__insurers` (right) are the two main blocks inside `.vergoeding__grid`.

- [ ] **Step 1: Add data-animate to both blocks**

```astro
<div class="vergoeding__content">
```
becomes:
```astro
<div class="vergoeding__content" data-animate>
```

```astro
<div class="vergoeding__insurers">
```
becomes:
```astro
<div class="vergoeding__insurers" data-animate>
```

- [ ] **Step 2: Verify in dev server**

Scroll to Vergoeding. Both blocks fade up together.

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/Vergoeding.astro
git commit -m "feat: add scroll reveal to Vergoeding section"
```

---

## Task 11: Add data-animate to Contact.astro

**Files:**
- Modify: `dental-template/src/components/Contact.astro`

`.contact__info` (left: title + contact details) and `.contact__form-wrapper` (right: the form) are the two main blocks inside `.contact__grid`.

- [ ] **Step 1: Add data-animate to both blocks**

```astro
<div class="contact__info">
```
becomes:
```astro
<div class="contact__info" data-animate>
```

```astro
<div class="contact__form-wrapper">
```
becomes:
```astro
<div class="contact__form-wrapper" data-animate>
```

- [ ] **Step 2: Verify in dev server**

Scroll to Contact. Both blocks fade up together.

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/Contact.astro
git commit -m "feat: add scroll reveal to Contact section"
```

---

## Task 12: Final visual QA

Run through the complete page and verify the full animation experience.

- [ ] **Step 1: Run the dev server and do a full scroll-through**

```bash
cd dental-template && npm run dev
```

Check each section in order:
- [ ] Hero text fades up on load (title → desc → actions, staggered)
- [ ] Nav gets shadow on scroll
- [ ] Services cards stagger in on scroll
- [ ] Features: image col → text col (120ms later) → feature items stagger
- [ ] Reviews cards stagger in
- [ ] About header + team grid fade in
- [ ] Quote block fades in
- [ ] OpeningHours both columns fade in
- [ ] Vergoeding both blocks fade in
- [ ] Contact both blocks fade in
- [ ] Footer: no animation (correct)

- [ ] **Step 2: Test with JS disabled**

In browser devtools → Settings → Debugger → "Disable JavaScript" → reload. All content must be immediately visible.

- [ ] **Step 3: Test with prefers-reduced-motion**

In browser devtools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce" → reload. No animations or transitions should fire.

- [ ] **Step 4: Switch themes and verify animation tokens differ**

In `dental-template/src/data/theme.json`, swap the content to `tech-innovation` preset values and reload. Animations should feel faster and snappier.

- [ ] **Step 5: Run a production build to confirm no build errors**

```bash
cd dental-template && npm run build
```

Expected: build completes with no errors.

- [ ] **Step 6: Commit any fixes from QA, then final commit**

```bash
git add -p  # stage only intentional changes
git commit -m "feat: complete micro-interactions implementation"
```
