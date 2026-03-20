# Site Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `scrape-sites.js` — a standalone pipeline step that scrapes prospect websites into `scrapes/{id}/scrape.json`, then wire that data into `build-sites.js`'s `buildPrompt()` so content generation is informed by the prospect's real site.

**Architecture:** Single-file Node.js ESM script following the `build-sites.js` style (imports at top, named helpers, `async main()` at bottom). Exports pure helper functions so they can be unit-tested without running `main()`. `build-sites.js` gains a `buildScrapedSection()` export and a `loadScrape()` helper; its `buildPrompt()` accepts an optional scrape argument. Both scripts guard `main()` behind `process.argv[1]` so they can be safely imported by tests.

**Tech Stack:** Node.js ESM (built-in `node:test` for unit tests), cheerio 1.x (HTML parsing), css-tree 3.x (CSS color parsing), Groq SDK (content analysis), optional Playwright (JS-heavy sites)

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `scrape-sites.js` | Standalone scraper script |
| Create | `test/colors.test.js` | Unit tests — color extraction helpers |
| Create | `test/logo.test.js` | Unit tests — logo URL extraction |
| Create | `test/menu.test.js` | Unit tests — menu extraction |
| Create | `test/content.test.js` | Unit tests — page text extraction + fetch error path |
| Create | `test/prompt.test.js` | Unit tests — buildScrapedSection |
| Create | `test/csv-columns.test.js` | Validates prospects.csv has new columns |
| Modify | `package.json` | Add `cheerio`, `css-tree`, `"test"` script |
| Modify | `prospects.csv` | Add `existing_url` + `scrape_status` columns |
| Modify | `build-sites.js` | Add `buildScrapedSection`, `loadScrape`; update `buildPrompt` + `generateSiteJson` + `main`; add `process.argv[1]` guard |

---

### Task 1: Dependencies + test infrastructure

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install new dependencies**

```bash
npm install cheerio css-tree
```

Expected: `package.json` dependencies updated with `"cheerio"` and `"css-tree"`.

- [ ] **Step 2: Add test script to package.json**

```json
{
  "name": "autosite-pipeline",
  "type": "module",
  "version": "0.0.1",
  "scripts": {
    "build": "node build-sites.js",
    "test": "node --test 'test/**/*.test.js'"
  },
  "dependencies": {
    "cheerio": "^1.0.0",
    "css-tree": "^3.0.0",
    "groq-sdk": "^0.9.0"
  }
}
```

- [ ] **Step 3: Verify the test runner works**

Create `test/smoke.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('smoke', () => { assert.equal(1 + 1, 2); });
```

Run: `npm test`
Expected: `✓ smoke`

- [ ] **Step 4: Delete the smoke test**

```bash
rm test/smoke.test.js
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add cheerio, css-tree deps and test runner"
```

---

### Task 2: CSV schema — new columns

**Files:**
- Create: `test/csv-columns.test.js`
- Modify: `prospects.csv`

- [ ] **Step 1: Write failing test**

Create `test/csv-columns.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

test('prospects.csv has existing_url column', () => {
  const headers = fs.readFileSync('prospects.csv', 'utf-8').split('\n')[0].split(',').map(h => h.trim());
  assert.ok(headers.includes('existing_url'), 'missing existing_url column');
});

test('prospects.csv has scrape_status column', () => {
  const headers = fs.readFileSync('prospects.csv', 'utf-8').split('\n')[0].split(',').map(h => h.trim());
  assert.ok(headers.includes('scrape_status'), 'missing scrape_status column');
});
```

Run: `npm test`
Expected: FAIL — columns not found.

- [ ] **Step 2: Add columns to prospects.csv**

Append `,existing_url,scrape_status` to the header line. Append `,, ` (two empty fields) to every existing data row. The updated header becomes:

```
id,business_name,city,phone,email,address,postal_code,scraped_text,services,brand_color_1,brand_color_2,style_preset,status,deployed_url,existing_url,scrape_status
```

- [ ] **Step 3: Run tests — verify pass**

Run: `npm test`
Expected: both column tests PASS.

- [ ] **Step 4: Commit**

```bash
git add prospects.csv test/csv-columns.test.js
git commit -m "feat: add existing_url and scrape_status columns to prospects.csv"
```

---

### Task 3: Color extraction helpers

The color pipeline is: raw CSS text → parse with css-tree → collect hex values from `color`/`background-color`/`background` declarations → normalize to hex → filter near-white/near-black → rank by frequency → pick primary, supporting, background. These are pure functions — ideal for TDD.

**Files:**
- Create: `scrape-sites.js` (color helpers only at this stage)
- Create: `test/colors.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/colors.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rgbToHsl, parseColorToHex, selectColors } from '../scrape-sites.js';

// ── rgbToHsl ──────────────────────────────────────────────────────────────────

test('rgbToHsl: red has hue=0, sat≈100, lightness≈50', () => {
  const { h, s, l } = rgbToHsl(255, 0, 0);
  assert.equal(h, 0);
  assert.ok(s > 90, `saturation should be ~100, got ${s}`);
  assert.ok(Math.abs(l - 50) < 2, `lightness should be ~50, got ${l}`);
});

test('rgbToHsl: white has lightness=100', () => {
  assert.equal(rgbToHsl(255, 255, 255).l, 100);
});

test('rgbToHsl: black has lightness=0', () => {
  assert.equal(rgbToHsl(0, 0, 0).l, 0);
});

// ── parseColorToHex ───────────────────────────────────────────────────────────

test('parseColorToHex: 6-digit hex passthrough', () => {
  assert.equal(parseColorToHex('#1a4a8a'), '#1a4a8a');
});

test('parseColorToHex: 3-digit hex expands', () => {
  assert.equal(parseColorToHex('#fff'), '#ffffff');
});

test('parseColorToHex: rgb()', () => {
  assert.equal(parseColorToHex('rgb(26, 74, 138)'), '#1a4a8a');
});

test('parseColorToHex: rgba() strips alpha', () => {
  assert.equal(parseColorToHex('rgba(26, 74, 138, 0.5)'), '#1a4a8a');
});

test('parseColorToHex: named white', () => {
  assert.equal(parseColorToHex('white'), '#ffffff');
});

test('parseColorToHex: named black', () => {
  assert.equal(parseColorToHex('black'), '#000000');
});

test('parseColorToHex: transparent → null', () => {
  assert.equal(parseColorToHex('transparent'), null);
});

test('parseColorToHex: linear-gradient → null', () => {
  assert.equal(parseColorToHex('linear-gradient(red, blue)'), null);
});

test('parseColorToHex: var() → null', () => {
  assert.equal(parseColorToHex('var(--color-primary)'), null);
});

// ── selectColors ──────────────────────────────────────────────────────────────

test('selectColors: picks primary and background from CSS', () => {
  const css = `
    .btn { background-color: #1a4a8a; }
    .btn { background-color: #1a4a8a; }
    body { background-color: #f5f0e8; }
    p    { color: #1a4a8a; }
  `;
  const { primary, background } = selectColors([css]);
  assert.equal(primary, '#1a4a8a');
  assert.equal(background, '#f5f0e8');
});

test('selectColors: returns all-null for empty CSS', () => {
  const { primary, supporting, background } = selectColors(['']);
  assert.equal(primary, null);
  assert.equal(supporting, null);
  assert.equal(background, null);
});

test('selectColors: excludes near-white and near-black', () => {
  const css = `body { background-color: #ffffff; color: #000000; }`;
  const { primary, background } = selectColors([css]);
  assert.equal(primary, null);
  assert.equal(background, null);
});

test('selectColors: picks supporting as second-most-frequent chromatic color', () => {
  const css = `
    .a { color: #1a4a8a; }
    .b { color: #1a4a8a; }
    .c { color: #1a4a8a; }
    .d { color: #c0392b; }
    .e { color: #c0392b; }
  `;
  const { primary, supporting } = selectColors([css]);
  assert.equal(primary, '#1a4a8a');
  assert.equal(supporting, '#c0392b');
});

test('selectColors: correctly parses rgb() values with spaces (not just hex)', () => {
  // This tests AST node walking — splitting on whitespace would break rgb(26, 74, 138)
  // into fragments like 'rgb(26,' which parseColorToHex cannot parse.
  const css = `
    .a { color: rgb(26, 74, 138); }
    .b { color: rgb(26, 74, 138); }
    body { background-color: rgb(245, 240, 232); }
  `;
  const { primary, background } = selectColors([css]);
  assert.equal(primary, '#1a4a8a');
  assert.equal(background, '#f5f0e8');
});
```

Run: `npm test`
Expected: FAIL — `scrape-sites.js` does not exist.

- [ ] **Step 2: Create scrape-sites.js with color helpers**

```js
#!/usr/bin/env node
/**
 * AutoSite Site Scraper
 * Reads prospects.csv → scrapes existing_url → writes scrapes/{id}/scrape.json
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as csstree from 'css-tree';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

const PROSPECTS_CSV = path.join(__dirname, 'prospects.csv');
const SCRAPES_DIR   = path.join(__dirname, 'scrapes');
const MODEL         = 'llama-3.3-70b-versatile';
const FETCH_TIMEOUT = 10_000;

// ── Color helpers ─────────────────────────────────────────────────────────────

/**
 * Convert RGB (0–255 each) to HSL (h: 0–360, s: 0–100, l: 0–100).
 */
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l   = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const NAMED_COLORS = { white: '#ffffff', black: '#000000' };

/**
 * Convert a CSS color value string to a normalized 6-digit hex string.
 * Returns null for transparent, gradients, var(), url(), or unknown formats.
 */
export function parseColorToHex(value) {
  const v = (value || '').trim().toLowerCase();
  if (!v || v === 'transparent' || v === 'inherit' || v === 'currentcolor') return null;
  if (v.startsWith('linear-gradient') || v.startsWith('radial-gradient') ||
      v.startsWith('var(') || v.startsWith('url(')) return null;

  if (NAMED_COLORS[v]) return NAMED_COLORS[v];

  const hex3 = v.match(/^#([0-9a-f]{3})$/);
  if (hex3) return '#' + hex3[1].split('').map(x => x + x).join('');

  if (/^#[0-9a-f]{6}$/.test(v)) return v;

  const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    const [, r, g, b] = rgb.map(Number);
    return '#' + [r, g, b].map(n => Math.min(255, n).toString(16).padStart(2, '0')).join('');
  }

  const hsl = v.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
  if (hsl) {
    const h = Number(hsl[1]) / 360;
    const s = Number(hsl[2]) / 100;
    const l = Number(hsl[3]) / 100;
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
  }

  return null;
}

const COLOR_PROPS = new Set(['color', 'background-color', 'background']);

/**
 * Given raw CSS text strings, extract { primary, supporting, background } hex colors.
 * - background: most-frequent color with lightness > 80%
 * - primary: most-frequent with saturation > 20% and lightness 10–70%
 * - supporting: second-most-frequent meeting the same criteria as primary
 * Missing fields are null.
 */
export function selectColors(cssTexts) {
  const freq = {};

  for (const cssText of cssTexts) {
    if (!cssText) continue;
    let ast;
    try { ast = csstree.parse(cssText, { onParseError: () => {} }); }
    catch { continue; }

    csstree.walk(ast, (node) => {
      if (node.type !== 'Declaration') return;
      if (!COLOR_PROPS.has(node.property.toLowerCase())) return;
      // Walk value child nodes directly — avoids splitting generated strings which
      // breaks rgb(26, 74, 138) into fragments like 'rgb(26,' that don't parse.
      csstree.walk(node.value, (valueNode) => {
        let hex = null;
        if (valueNode.type === 'HexColor') {
          hex = parseColorToHex('#' + valueNode.value);
        } else if (valueNode.type === 'Function' &&
                   ['rgb', 'rgba', 'hsl', 'hsla'].includes(valueNode.name.toLowerCase())) {
          hex = parseColorToHex(csstree.generate(valueNode));
        } else if (valueNode.type === 'Identifier') {
          hex = parseColorToHex(valueNode.name);
        }
        if (hex) freq[hex] = (freq[hex] || 0) + 1;
      });
    });
  }

  const getHsl = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return rgbToHsl(r, g, b);
  };

  const filtered = Object.entries(freq)
    .filter(([hex]) => { const { l } = getHsl(hex); return l > 5 && l < 95; })
    .sort((a, b) => b[1] - a[1]);

  const bgEntry    = filtered.find(([hex]) => getHsl(hex).l > 80);
  const background = bgEntry ? bgEntry[0] : null;

  const primaryCandidates = filtered.filter(([hex]) => {
    const { s, l } = getHsl(hex);
    return s > 20 && l >= 10 && l <= 70;
  });
  const primary    = primaryCandidates[0]?.[0] ?? null;
  const supporting = primaryCandidates[1]?.[0] ?? null;

  return { primary, supporting, background };
}
```

- [ ] **Step 3: Run tests — verify pass**

Run: `npm test`
Expected: all color tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scrape-sites.js test/colors.test.js
git commit -m "feat: color extraction helpers with tests"
```

---

### Task 4: Logo extraction

**Files:**
- Modify: `scrape-sites.js` (add logo helpers)
- Create: `test/logo.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/logo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { extractLogoUrl } from '../scrape-sites.js';

test('finds logo img in header by class', () => {
  const $ = cheerio.load('<header><img class="site-logo" src="/img/logo.png"></header>');
  assert.equal(extractLogoUrl($, 'https://example.nl'), 'https://example.nl/img/logo.png');
});

test('finds logo img in nav by alt text containing "logo"', () => {
  const $ = cheerio.load('<nav><img alt="Logo van de praktijk" src="/logo.svg"></nav>');
  assert.equal(extractLogoUrl($, 'https://example.nl'), 'https://example.nl/logo.svg');
});

test('finds logo img by id="logo"', () => {
  const $ = cheerio.load('<header><img id="logo" src="https://cdn.example.nl/logo.png"></header>');
  assert.equal(extractLogoUrl($, 'https://example.nl'), 'https://cdn.example.nl/logo.png');
});

test('finds logo when "logo" appears in src path', () => {
  const $ = cheerio.load('<header><img src="/assets/logo-2024.png"></header>');
  assert.equal(extractLogoUrl($, 'https://example.nl'), 'https://example.nl/assets/logo-2024.png');
});

test('falls back to apple-touch-icon when no logo img found', () => {
  const $ = cheerio.load(`
    <head><link rel="apple-touch-icon" href="/apple-touch-icon.png"></head>
    <body><header><img src="/hero.jpg"></header></body>
  `);
  assert.equal(extractLogoUrl($, 'https://example.nl'), 'https://example.nl/apple-touch-icon.png');
});

test('returns null when nothing logo-like found', () => {
  const $ = cheerio.load('<header><img src="/hero.jpg"></header>');
  assert.equal(extractLogoUrl($, 'https://example.nl'), null);
});

test('does not use og:image', () => {
  const $ = cheerio.load(`
    <head><meta property="og:image" content="https://example.nl/promo.jpg"></head>
    <body></body>
  `);
  assert.equal(extractLogoUrl($, 'https://example.nl'), null);
});
```

Run: `npm test`
Expected: FAIL — `extractLogoUrl` not exported.

- [ ] **Step 2: Add logo helpers to scrape-sites.js**

Add this block after the color helpers section:

```js
// ── URL helpers ───────────────────────────────────────────────────────────────

function resolveUrl(href, base) {
  try { return new URL(href, base).href; } catch { return null; }
}

// ── Logo helpers ──────────────────────────────────────────────────────────────

/**
 * Find the logo URL in a parsed HTML page.
 * Search order:
 *   1. <header>/<nav> img where class, id, alt, or src contains "logo" (case-insensitive)
 *   2. <link rel="apple-touch-icon"> href
 * og:image is intentionally skipped — it returns promotional photos, not logos.
 * Returns an absolute URL string or null.
 */
export function extractLogoUrl($, baseUrl) {
  let found = null;
  $('header img, nav img').each((_, el) => {
    if (found) return;
    const src = $(el).attr('src')   || '';
    const cls = $(el).attr('class') || '';
    const id  = $(el).attr('id')    || '';
    const alt = $(el).attr('alt')   || '';
    if ((src + cls + id + alt).toLowerCase().includes('logo')) found = src;
  });
  if (found) return resolveUrl(found, baseUrl);

  const touchIcon = $('link[rel="apple-touch-icon"]').attr('href');
  if (touchIcon) return resolveUrl(touchIcon, baseUrl);

  return null;
}

/**
 * Download a logo from a URL and save it to destDir.
 * Extension is inferred from Content-Type, falling back to the URL path.
 * Returns the saved filename (e.g. "logo.png") or null on failure.
 */
export async function downloadLogo(logoUrl, destDir) {
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) return null;
    const ct  = res.headers.get('content-type') || '';
    const ext = ct.includes('svg')  ? 'svg'
              : ct.includes('png')  ? 'png'
              : ct.includes('jpg') || ct.includes('jpeg') ? 'jpg'
              : ct.includes('webp') ? 'webp'
              : (path.extname(new URL(logoUrl).pathname).slice(1) || 'png');
    const filename = `logo.${ext}`;
    fs.writeFileSync(path.join(destDir, filename), Buffer.from(await res.arrayBuffer()));
    return filename;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Run tests — verify pass**

Run: `npm test`
Expected: all logo tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scrape-sites.js test/logo.test.js
git commit -m "feat: logo URL extraction and download with tests"
```

---

### Task 5: Menu extraction

**Files:**
- Modify: `scrape-sites.js` (add menu helper)
- Create: `test/menu.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/menu.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { extractMenu } from '../scrape-sites.js';

test('extracts flat nav links', () => {
  const $ = cheerio.load(`
    <nav><ul>
      <li><a href="/">Home</a></li>
      <li><a href="/over-ons">Over Ons</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul></nav>
  `);
  const menu = extractMenu($, 'https://example.nl');
  assert.equal(menu.length, 3);
  assert.equal(menu[0].label, 'Home');
  assert.equal(menu[0].href, 'https://example.nl/');
  assert.equal(menu[2].label, 'Contact');
});

test('extracts one level of nesting', () => {
  const $ = cheerio.load(`
    <nav><ul>
      <li>
        <a href="/behandelingen">Behandelingen</a>
        <ul>
          <li><a href="/behandelingen/implantaten">Implantaten</a></li>
          <li><a href="/behandelingen/bleken">Bleken</a></li>
        </ul>
      </li>
    </ul></nav>
  `);
  const menu = extractMenu($, 'https://example.nl');
  assert.equal(menu.length, 1);
  assert.equal(menu[0].label, 'Behandelingen');
  assert.equal(menu[0].children.length, 2);
  assert.equal(menu[0].children[0].label, 'Implantaten');
});

test('returns null when no <nav> element found', () => {
  const $ = cheerio.load('<div><a href="/">Home</a></div>');
  assert.equal(extractMenu($, 'https://example.nl'), null);
});

test('flattens deeply nested items into parent children array', () => {
  const $ = cheerio.load(`
    <nav><ul>
      <li>
        <a href="/a">A</a>
        <ul>
          <li>
            <a href="/a/b">B</a>
            <ul><li><a href="/a/b/c">C</a></li></ul>
          </li>
        </ul>
      </li>
    </ul></nav>
  `);
  const menu = extractMenu($, 'https://example.nl');
  const aItem = menu[0];
  assert.ok(aItem.children.some(c => c.label === 'B'), 'B should be in children');
  assert.ok(aItem.children.some(c => c.label === 'C'), 'C should be flattened into children');
});

test('resolves relative hrefs to absolute URLs', () => {
  const $ = cheerio.load('<nav><ul><li><a href="/diensten">Diensten</a></li></ul></nav>');
  const menu = extractMenu($, 'https://tandarts.nl');
  assert.equal(menu[0].href, 'https://tandarts.nl/diensten');
});
```

Run: `npm test`
Expected: FAIL — `extractMenu` not exported.

- [ ] **Step 2: Add extractMenu to scrape-sites.js**

Add after the logo helpers:

```js
// ── Menu helpers ──────────────────────────────────────────────────────────────

/**
 * Extract the primary navigation menu from a parsed HTML page.
 * One level of nesting is captured; deeper levels are flattened into the
 * parent's children array.
 * Returns an array of { label, href, children? } or null if no <nav> found.
 */
export function extractMenu($, baseUrl) {
  const nav = $('nav').first();
  if (!nav.length) return null;

  const parseItems = ($list) => {
    const items = [];
    $list.children('li').each((_, li) => {
      const $li = $(li);
      const $a  = $li.children('a').first();
      if (!$a.length) return;
      const label = $a.text().trim();
      const href  = resolveUrl($a.attr('href') || '#', baseUrl) || '#';
      const $sub  = $li.children('ul').first();
      const item  = { label, href };
      if ($sub.length) {
        const children = parseItems($sub);
        if (children.length) item.children = children;
      }
      items.push(item);
    });
    return items;
  };

  const flatten = (items) => items.map(item => {
    if (!item.children) return item;
    const flat = { label: item.label, href: item.href, children: [] };
    const collect = (children) => {
      for (const c of children) {
        flat.children.push({ label: c.label, href: c.href });
        if (c.children) collect(c.children);
      }
    };
    collect(item.children);
    if (!flat.children.length) delete flat.children;
    return flat;
  });

  const topUl = nav.find('ul').first();
  if (!topUl.length) return null;
  return flatten(parseItems(topUl));
}
```

- [ ] **Step 3: Run tests — verify pass**

Run: `npm test`
Expected: all menu tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scrape-sites.js test/menu.test.js
git commit -m "feat: menu extraction with tests"
```

---

### Task 6: Page text extraction + content analysis helpers

**Files:**
- Modify: `scrape-sites.js` (add text extraction, Groq analysis, HTTP helpers)
- Create: `test/content.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/content.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { extractPageText, fetchPage } from '../scrape-sites.js';

test('includes headings and paragraph text', () => {
  const $ = cheerio.load(`
    <body>
      <h1>Welkom bij Tandartspraktijk Noord</h1>
      <p>Wij bieden professionele zorg.</p>
      <h2>Onze Diensten</h2>
    </body>
  `);
  const text = extractPageText($);
  assert.ok(text.includes('Welkom bij Tandartspraktijk Noord'));
  assert.ok(text.includes('Onze Diensten'));
  assert.ok(text.includes('professionele zorg'));
});

test('strips script, style, and SVG content', () => {
  const $ = cheerio.load(`
    <body>
      <script>var secret = 1;</script>
      <style>body { color: red; }</style>
      <svg><text>svg text</text></svg>
      <p>Real content</p>
    </body>
  `);
  const text = extractPageText($);
  assert.ok(!text.includes('secret'),     'script content must be removed');
  assert.ok(!text.includes('color: red'), 'style content must be removed');
  assert.ok(!text.includes('svg text'),   'SVG content must be removed');
  assert.ok(text.includes('Real content'));
});

test('includes nav link labels', () => {
  const $ = cheerio.load(`
    <nav><a href="/">Home</a><a href="/contact">Contact</a></nav>
    <main><p>Body</p></main>
  `);
  const text = extractPageText($);
  assert.ok(text.includes('Home'));
  assert.ok(text.includes('Contact'));
});

test('caps output at 6000 characters', () => {
  const $ = cheerio.load(`<body><p>${'A'.repeat(10_000)}</p></body>`);
  const text = extractPageText($);
  assert.ok(text.length <= 6000, `expected ≤6000 chars, got ${text.length}`);
});

test('fetchPage returns null for unreachable URL', async () => {
  const result = await fetchPage('http://localhost:19999/no-server-here');
  assert.equal(result, null);
});
```

Run: `npm test`
Expected: FAIL — `extractPageText` and `fetchPage` not exported.

- [ ] **Step 2: Add extractPageText, analyseContent, fetchPage, and fetchCssTexts to scrape-sites.js**

Add these blocks after the menu helpers:

```js
// ── Content helpers ───────────────────────────────────────────────────────────

/**
 * Strip a cheerio-parsed page to readable text for LLM analysis.
 * Removes scripts, styles, SVGs. Extracts h1–h3, p, nav links, footer.
 * Caps at 6000 characters.
 */
export function extractPageText($) {
  $('script, style, svg, noscript').remove();
  const parts = [];
  $('h1, h2, h3, p, nav a, footer').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text) parts.push(text);
  });
  return parts.join('\n').slice(0, 6000);
}

/**
 * Call Groq to extract structured sections and content from raw page text.
 * Returns { sections, content } or { sections: null, content: null } on any failure.
 */
async function analyseContent(pageText, groqClient) {
  const prompt = `Je bent een data-extractor voor tandartspraktijkwebsites.
Analyseer de onderstaande websitetekst en retourneer ALLEEN geldige JSON.

Extraheer:
- sections: een geordende array van secties die aanwezig zijn op de pagina.
  Gebruik uitsluitend deze waarden: hero, about, services, team, reviews, hours, contact, other
- content: ruwe tekst per sectie, exact zoals op de site (verbeter de copy NIET)
  - headline: hoofdkop van de pagina
  - about: over ons tekst
  - services: array van { name, description }
  - team: array van { name, role }
  - phone, email, address: contactgegevens
  - hours: array van { day, time }

Websitetekst:
${pageText}

Geef ALLEEN de JSON terug:
{
  "sections": [...],
  "content": {
    "headline": "...",
    "about": "...",
    "services": [...],
    "team": [...],
    "phone": "...",
    "email": "...",
    "address": "...",
    "hours": [...]
  }
}`;

  try {
    const response = await groqClient.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.choices[0].message.content.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(raw);
    return { sections: parsed.sections ?? null, content: parsed.content ?? null };
  } catch (err) {
    console.warn(`    ⚠ Content analysis failed: ${err.message}`);
    return { sections: null, content: null };
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

const CDN_SKIP = ['fonts.googleapis.com', 'cdnjs.cloudflare.com', 'use.fontawesome.com'];

/**
 * Fetch a URL and return a cheerio-parsed document.
 * Returns null on timeout, non-200, or parse error.
 */
export async function fetchPage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) { console.warn(`    ⚠ HTTP ${res.status} for ${url}`); return null; }
    return cheerio.load(await res.text());
  } catch (err) {
    console.warn(`    ⚠ Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Collect all CSS text for a page: inline <style> blocks + linked stylesheets.
 * Skips external CDN URLs (Google Fonts, cdnjs, etc.).
 */
async function fetchCssTexts($, baseUrl) {
  const texts = [];
  $('style').each((_, el) => { texts.push($(el).html() || ''); });

  const hrefs = [];
  $('head link[rel="stylesheet"]').each((_, el) => {
    const href     = $(el).attr('href');
    if (!href) return;
    const resolved = resolveUrl(href, baseUrl);
    if (!resolved) return;
    try {
      const host = new URL(resolved).hostname;
      if (CDN_SKIP.some(d => host.includes(d))) return;
    } catch { return; }
    hrefs.push(resolved);
  });

  await Promise.all(hrefs.map(async (href) => {
    try {
      const res = await fetch(href, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
      if (res.ok) texts.push(await res.text());
    } catch { /* skip on error */ }
  }));

  return texts;
}
```

- [ ] **Step 3: Run tests — verify pass**

Run: `npm test`
Expected: all content tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scrape-sites.js test/content.test.js
git commit -m "feat: page text extraction, Groq analysis, and HTTP helpers with tests"
```

---

### Task 7: Orchestrate scrapeSite + main loop

Wire all helpers into `scrapeSite()` and build the `main()` entry point with CSV helpers and `.env` loader.

**Files:**
- Modify: `scrape-sites.js` (append CSV helpers, `.env` loader, Playwright fallback, `scrapeSite`, `main`)

- [ ] **Step 1: Append remaining scaffolding to scrape-sites.js**

```js
// ── CSV helpers ───────────────────────────────────────────────────────────────
// Same format and delimiter as build-sites.js.

function parseCSV(content) {
  const lines   = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]));
  });
}

function parseCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuotes = !inQuotes; }
    else if (line[i] === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += line[i]; }
  }
  result.push(current);
  return result;
}

function serializeCSV(records) {
  const headers = Object.keys(records[0]);
  const lines   = [headers.join(',')];
  for (const record of records) {
    const values = headers.map(h => {
      const val = String(record[h] ?? '');
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"` : val;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n') + '\n';
}

function setField(records, id, field, value) {
  const record = records.find(r => r.id === id);
  if (record) record[field] = value;
}

function saveCSV(records) { fs.writeFileSync(PROSPECTS_CSV, serializeCSV(records)); }

// ── .env loader ───────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq  = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
}

// ── Playwright (opt-in) ───────────────────────────────────────────────────────

/**
 * Fetch a page using Playwright (Chromium).
 * CSS is collected via network response interception (text/css) — matching how
 * browsers actually load stylesheets, including dynamically injected ones.
 * Returns { $: CheerioAPI, cssTexts: string[] } or { $: null, cssTexts: [] } on failure.
 */
async function fetchPagePlaywright(url) {
  let pw;
  try { pw = await import('playwright'); }
  catch {
    console.error('    ✗ Playwright not installed. Run: npm install playwright');
    return { $: null, cssTexts: [] };
  }
  const browser = await pw.chromium.launch();
  const cssTexts = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    // Collect CSS via network interception — avoids re-fetching with fetch()
    page.on('response', async (response) => {
      const ct = response.headers()['content-type'] || '';
      if (ct.includes('text/css')) {
        try { cssTexts.push(await response.text()); } catch { /* skip */ }
      }
    });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    return { $: cheerio.load(await page.content()), cssTexts };
  } catch (err) {
    console.warn(`    ⚠ Playwright fetch failed: ${err.message}`);
    return { $: null, cssTexts: [] };
  } finally {
    await browser.close();
  }
}

// ── Core scrape orchestrator ──────────────────────────────────────────────────

/**
 * Scrape one prospect. Writes scrapes/{id}/scrape.json and optional logo file.
 * Returns 'completed' or 'failed'.
 */
async function scrapeSite(prospect, groqClient, usePlaywright = false) {
  const url = prospect.existing_url?.trim();
  if (!url) { console.warn('    ⚠ No existing_url — skipping'); return 'failed'; }

  console.log(`    ⟳ Fetching ${url}...`);
  let $, cssTexts;
  if (usePlaywright) {
    const result = await fetchPagePlaywright(url);
    $ = result.$;
    cssTexts = result.cssTexts;
  } else {
    $ = await fetchPage(url);
    cssTexts = $ ? await fetchCssTexts($, url) : [];
  }
  if (!$) return 'failed';
  console.log('    ✓ Page fetched');

  const destDir = path.join(SCRAPES_DIR, prospect.id);
  fs.mkdirSync(destDir, { recursive: true });

  // Logo
  const logoUrl = extractLogoUrl($, url);
  let logo_file = null;
  if (logoUrl) {
    logo_file = await downloadLogo(logoUrl, destDir);
    if (logo_file) console.log(`    ✓ Logo saved: ${logo_file}`);
    else           console.warn('    ⚠ Logo download failed');
  }

  // Colors
  console.log('    ⟳ Extracting colors...');
  const colors = selectColors(cssTexts);
  console.log(`    ✓ Colors: primary=${colors.primary}, bg=${colors.background}`);

  // Menu
  const menu = extractMenu($, url);
  console.log(`    ✓ Menu: ${menu ? menu.length + ' items' : 'none found'}`);

  // Content analysis (Groq — skipped if no API key)
  let sections = null, content = null;
  if (groqClient) {
    console.log('    ⟳ Analysing content...');
    const pageText = extractPageText($);
    ({ sections, content } = await analyseContent(pageText, groqClient));
    console.log(`    ✓ Sections: ${sections ? sections.join(', ') : 'none'}`);
  }

  // Write scrape.json — missing fields are null, not omitted
  const scrape = {
    url,
    scraped_at: new Date().toISOString(),
    logo_file:  logo_file ?? null,
    colors:     {
      primary:    colors.primary    ?? null,
      supporting: colors.supporting ?? null,
      background: colors.background ?? null,
    },
    menu:     menu     ?? null,
    sections: sections ?? null,
    content:  content  ?? null,
  };
  fs.writeFileSync(path.join(destDir, 'scrape.json'), JSON.stringify(scrape, null, 2));
  console.log(`    ✓ scrapes/${prospect.id}/scrape.json written`);

  return 'completed';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const usePlaywright = process.argv.includes('--playwright');

  if (!process.env.GROQ_API_KEY) {
    console.warn('⚠ GROQ_API_KEY not set — content analysis (sections/content) will be skipped.');
  }

  const { default: Groq } = await import('groq-sdk');
  const groqClient = process.env.GROQ_API_KEY
    ? new Groq({ apiKey: process.env.GROQ_API_KEY })
    : null;

  if (!fs.existsSync(SCRAPES_DIR)) fs.mkdirSync(SCRAPES_DIR, { recursive: true });

  const records = parseCSV(fs.readFileSync(PROSPECTS_CSV, 'utf-8'));
  const pending = records.filter(r => r.scrape_status === 'pending' && r.existing_url?.trim());

  console.log('\n🔍  AutoSite Scraper' + (usePlaywright ? ' (Playwright mode)' : ''));
  console.log(`    ${pending.length} pending prospect(s)\n`);

  if (pending.length === 0) {
    console.log('    Nothing to do — set scrape_status to "pending" and add existing_url in prospects.csv.');
    return;
  }

  for (const prospect of pending) {
    console.log(`\n── ${prospect.business_name} (${prospect.city}) ──`);
    const status = await scrapeSite(prospect, groqClient, usePlaywright);
    setField(records, prospect.id, 'scrape_status', status);
    saveCSV(records);
  }

  const done   = records.filter(r => r.scrape_status === 'completed').length;
  const failed = records.filter(r => r.scrape_status === 'failed').length;
  console.log(`\n✓  Done — ${done} scraped, ${failed} failed\n`);
}

// Run only when executed directly — not when imported by tests
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error('\nFatal error:', err.message); process.exit(1); });
}
```

- [ ] **Step 2: Run all tests — verify nothing broke**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 3: Smoke-test the script with no pending prospects**

```bash
node scrape-sites.js
```

Expected: "Nothing to do — set scrape_status to "pending" and add existing_url in prospects.csv."

- [ ] **Step 4: Commit**

```bash
git add scrape-sites.js
git commit -m "feat: scrape orchestrator and main loop"
```

---

### Task 8: buildPrompt() integration in build-sites.js

`build-sites.js` needs to (a) export `buildScrapedSection` for testing, (b) guard `main()` behind `process.argv[1]` so it can be imported, and (c) load and inject scrape data when present.

**Files:**
- Modify: `build-sites.js`
- Create: `test/prompt.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/prompt.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScrapedSection } from '../build-sites.js';

test('returns empty string for null scrape', () => {
  assert.equal(buildScrapedSection(null), '');
});

test('returns empty string when both sections and content are null', () => {
  assert.equal(buildScrapedSection({ sections: null, content: null }), '');
});

test('returns Dutch section block listing sections', () => {
  const scrape = {
    sections: ['hero', 'about', 'contact'],
    content: { headline: 'Welkom', about: 'Wij zijn...' },
  };
  const result = buildScrapedSection(scrape);
  assert.ok(result.includes('hero, about, contact'), 'should list section names');
  assert.ok(result.includes('Welkom'), 'should include serialized content');
});

test('handles null sections without throwing', () => {
  const scrape = { sections: null, content: { headline: 'Test' } };
  const result = buildScrapedSection(scrape);
  assert.equal(typeof result, 'string');
  assert.ok(result.length > 0, 'should return non-empty block when content exists');
});
```

Run: `npm test`
Expected: FAIL — importing `build-sites.js` runs `main()`.

- [ ] **Step 2: Add process.argv[1] guard to build-sites.js**

At the bottom of `build-sites.js`, replace:

```js
main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
```

With:

```js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('\nFatal error:', err.message);
    process.exit(1);
  });
}
```

Run: `npm test`
Expected: prompt tests no longer error on import (but still FAIL on the missing export).

- [ ] **Step 3: Add buildScrapedSection export to build-sites.js**

Add immediately after the `buildPrompt` function (after its closing `}`):

```js
/**
 * Build the Dutch-language scrape context block to append to the content prompt.
 * Returns empty string if no usable scrape data is available.
 * Only injects sections + content — colors and menu are reserved for future use.
 */
export function buildScrapedSection(scrape) {
  if (!scrape || (!scrape.sections && !scrape.content)) return '';
  const sectionsStr = Array.isArray(scrape.sections)
    ? scrape.sections.join(', ')
    : 'onbekend';
  return `

## Huidige website van de praktijk

De prospect heeft een bestaande website met de volgende structuur en inhoud.
Gebruik dit als referentie — neem alle relevante informatie mee, maar herschrijf
alle teksten zodat ze professioneler, warmer en patiëntgerichter zijn.

Secties op de huidige site: ${sectionsStr}

Huidige inhoud (ruw):
${JSON.stringify(scrape.content, null, 2)}`;
}
```

- [ ] **Step 4: Run tests — verify prompt tests pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Update buildPrompt to accept scrape + append the section**

Change the `buildPrompt` function signature from:

```js
function buildPrompt(p) {
```

To:

```js
function buildPrompt(p, scrape = null) {
```

At the very end of the `buildPrompt` return string, just before the closing backtick, append `${buildScrapedSection(scrape)}`:

```js
Geef ALLEEN de JSON terug. Geen uitleg, geen markdown, puur JSON.${buildScrapedSection(scrape)}`;
}
```

- [ ] **Step 6: Update generateSiteJson to accept and forward scrape**

Change:

```js
async function generateSiteJson(client, prospect) {
  ...
  content: buildPrompt(prospect),
```

To:

```js
async function generateSiteJson(client, prospect, scrape = null) {
  ...
  content: buildPrompt(prospect, scrape),
```

- [ ] **Step 7: Add loadScrape helper to build-sites.js**

Add after the `saveCSV` function:

```js
/**
 * Load scrapes/{id}/scrape.json if it exists. Returns null if not found.
 */
function loadScrape(id) {
  const p = path.join(__dirname, 'scrapes', id, 'scrape.json');
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch { return null; }
}
```

- [ ] **Step 8: Load scrape in main() before generateSiteJson**

In `main()`, find:

```js
          console.log('    ⟳ Generating content...');
          siteJson = await generateSiteJson(client, prospect);
```

Replace with:

```js
          console.log('    ⟳ Generating content...');
          const scrape = loadScrape(prospect.id);
          if (scrape) console.log(`    ✓ Scrape data loaded for prospect ${prospect.id}`);
          siteJson = await generateSiteJson(client, prospect, scrape);
```

- [ ] **Step 9: Run all tests — verify pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 10: Smoke-test build pipeline**

```bash
node build-sites.js --dummy
```

Expected: pipeline runs without errors (no scrape files exist → falls back to CSV-only, unchanged behavior).

- [ ] **Step 11: Commit**

```bash
git add build-sites.js test/prompt.test.js
git commit -m "feat: inject scrape context into buildPrompt() when scrape.json exists"
```

---

### Task 9: End-to-end smoke test

Manually verify the full scraper works against a real prospect URL.

**Files:**
- Modify: `prospects.csv` (temporarily)
- Possibly modify: `.gitignore`

- [ ] **Step 1: Check .gitignore for scrapes/**

```bash
cat .gitignore
```

If `scrapes/` is not listed, add it (similar to `builds/` which is also gitignored per CLAUDE.md):

```bash
echo "scrapes/" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore scrapes/ directory"
```

- [ ] **Step 2: Set one prospect to scrape-pending**

In `prospects.csv`, pick any row (e.g. `id=1`) and set:
- `existing_url` = the practice's real website URL
- `scrape_status` = `pending`

- [ ] **Step 3: Run the scraper**

```bash
node scrape-sites.js
```

Expected:
- Progress lines print for each step without crashing
- `scrapes/1/scrape.json` is created
- `scrape_status` in CSV is updated to `completed` or `failed`

- [ ] **Step 4: Inspect the output**

```bash
cat scrapes/1/scrape.json
```

Verify:
- Valid JSON
- `url` and `scraped_at` are present
- All other fields are values or `null` — none are `undefined` or absent entirely

- [ ] **Step 5: Reset the test row and commit**

Set `scrape_status` back to empty string for the row used above.

```bash
git add prospects.csv
git commit -m "chore: reset smoke-test scrape_status after manual test"
```

---

## Done

The scraper is wired end-to-end. To use it:

1. Add `existing_url` and set `scrape_status=pending` for prospects in `prospects.csv`
2. Run `node scrape-sites.js` (or add `--playwright` for JS-heavy sites)
3. Run `node build-sites.js` as normal — scrape data is automatically injected into the Groq prompt when present

Content generation falls back to CSV-only data if no scrape file exists. `scrape_status=failed` never blocks building.
