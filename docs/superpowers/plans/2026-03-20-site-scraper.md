# Site Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `scrape-sites.js` — a standalone script that fetches prospect dental websites and extracts logo, color palette, menu structure, and content into `scrapes/{id}/scrape.json` to enrich the site generation prompt.

**Architecture:** Single-file script (`scrape-sites.js`) following the same pattern as `build-sites.js` — reads `prospects.csv`, processes `scrape_status=pending` rows sequentially, writes output to `scrapes/{id}/`, updates CSV after each prospect. Pure extraction functions are colocated in the same file under clear section comments for easy testing via a separate `tests/scraper.test.js`.

**Tech Stack:** Node.js ESM, `cheerio` (HTML parsing), `css-tree` (CSS parsing), Groq SDK (already installed), Node.js built-in `node:test` + `assert` for tests.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `scrape-sites.js` | Create | Main script — CSV loop, fetch, orchestration, output |
| `tests/scraper.test.js` | Create | Unit tests for pure extraction functions |
| `build-sites.js` | Modify | Inject scrape data into `buildPrompt()` |
| `package.json` | Modify | Add `css-tree` dependency |

---

### Task 1: Install dependency + scaffold

**Files:**
- Modify: `package.json`
- Create: `scrape-sites.js` (skeleton only)
- Create: `scrapes/.gitkeep`

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/masidawoud/Dev/autosite
npm install css-tree
# cheerio may already be installed (shared with qualify-prospects.js) — verify:
node -e "import('cheerio').then(() => console.log('cheerio ok')).catch(() => process.exit(1))" || npm install cheerio
```

Expected: both `css-tree` and `cheerio` in `package.json` dependencies.

- [ ] **Step 2: Add new CSV columns to prospects.csv**

Open `prospects.csv` and add two columns to the header row and all data rows:
- `existing_url` — the prospect's current website URL (fill in real URLs for prospects you want to scrape)
- `scrape_status` — leave blank or set to `pending` for prospects to scrape

- [ ] **Step 3: Create scrapes directory**

```bash
mkdir -p scrapes && touch scrapes/.gitkeep
```

- [ ] **Step 4: Create scrape-sites.js skeleton**

```js
#!/usr/bin/env node
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as csstree from 'css-tree';
import * as cheerio from 'cheerio';
import Groq from 'groq-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROSPECTS_CSV = path.join(__dirname, 'prospects.csv');
const SCRAPES_DIR   = path.join(__dirname, 'scrapes');
const MODEL         = 'llama-3.3-70b-versatile';

// ── CSV helpers (copy parseCSV / parseCSVLine / serializeCSV from build-sites.js) ──
// ── .env loader (copy loadEnv from build-sites.js) ──

// ── Color extraction ──
// ── Logo extraction ──
// ── Menu extraction ──
// ── Content analysis ──
// ── Site fetcher ──
// ── Main ──
```

- [ ] **Step 4: Commit scaffold**

```bash
git add package.json package-lock.json scrapes/.gitkeep scrape-sites.js
git commit -m "feat: scaffold scrape-sites.js and install css-tree"
```

---

### Task 2: Color extraction

**Files:**
- Modify: `scrape-sites.js` (color section)
- Create: `tests/scraper.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/scraper.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Import from scrape-sites once exported — for now paste function here for TDD
// We'll test extractColors directly

import { extractColors } from '../scrape-sites.js';

test('extracts primary and background from basic CSS', () => {
  const css = `
    body { background-color: #ffffff; color: #1a4a8a; }
    .btn  { background-color: #1a4a8a; }
    .card { background-color: #f0f4ff; color: #3d7ab5; }
  `;
  const result = extractColors(css);
  assert.equal(result.background, '#ffffff');
  assert.equal(result.primary, '#1a4a8a');
  assert.equal(result.supporting, '#3d7ab5');
});

test('returns null fields when no usable colors found', () => {
  const css = `body { background: var(--bg); color: var(--text); }`;
  const result = extractColors(css);
  assert.equal(result.primary, null);
  assert.equal(result.background, null);
  assert.equal(result.supporting, null);
});

test('ignores gradients and url() values', () => {
  const css = `
    body { background: linear-gradient(#fff, #000); }
    .hero { background: url('/img/bg.jpg'); color: #1a4a8a; }
  `;
  const result = extractColors(css);
  assert.equal(result.primary, '#1a4a8a');
});

test('handles rgb() colors', () => {
  const css = `body { background-color: rgb(255,255,255); color: rgb(26,74,138); }`;
  const result = extractColors(css);
  assert.equal(result.background, '#ffffff');
  assert.equal(result.primary, '#1a4a8a');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
node --test tests/scraper.test.js
```

Expected: fails with `SyntaxError` or `Cannot find named export 'extractColors'`

- [ ] **Step 3: Implement `extractColors`**

Add to `scrape-sites.js` (color section) and export:

```js
// ── Color helpers ─────────────────────────────────────────────────────────────

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h,s, l=(max+min)/2;
  if (max===min) { h=s=0; } else {
    const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){ case r:h=(g-b)/d+(g<b?6:0);break; case g:h=(b-r)/d+2;break; case b:h=(r-g)/d+4;break; }
    h/=6;
  }
  return { h:h*360, s:s*100, l:l*100 };
}

function parseColorToHex(value) {
  if (!value || typeof value !== 'string') return null;
  value = value.trim();
  // skip non-color values
  if (value.startsWith('var(') || value.startsWith('linear-gradient') ||
      value.startsWith('url(') || value === 'transparent' || value === 'inherit' ||
      value === 'currentColor' || value === 'none') return null;
  // 6-digit hex
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  // 3-digit hex
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return '#' + value[1]+value[1]+value[2]+value[2]+value[3]+value[3];
  }
  // rgb/rgba
  const rgb = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    return '#' + [rgb[1],rgb[2],rgb[3]]
      .map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
  }
  // hsl/hsla — convert to hex via canvas not available in Node; skip
  return null;
}

const NAMED_COLORS = { white:'#ffffff', black:'#000000', red:'#ff0000',
  blue:'#0000ff', green:'#008000', gray:'#808080', grey:'#808080' };

export function extractColors(cssText) {
  const freq = {};
  let ast;
  try { ast = csstree.parse(cssText, { onParseError: () => {} }); }
  catch { return { primary: null, supporting: null, background: null }; }

  csstree.walk(ast, node => {
    if (node.type !== 'Declaration') return;
    const prop = node.property?.toLowerCase();
    if (!['color','background-color','background'].includes(prop)) return;
    const raw = csstree.generate(node.value);
    const hex = NAMED_COLORS[raw.toLowerCase()] ?? parseColorToHex(raw);
    if (!hex) return;
    freq[hex] = (freq[hex] || 0) + 1;
  });

  const usable = Object.entries(freq)
    .map(([hex, count]) => ({ hex, count, hsl: hexToHsl(hex) }))
    .filter(c => c.hsl.l > 4 && c.hsl.l < 96); // exclude near-black and near-white

  const bg   = usable.filter(c => c.hsl.l > 80).sort((a,b) => b.count-a.count)[0];
  const saturated = usable.filter(c => c.hsl.s > 20 && c.hsl.l >= 10 && c.hsl.l <= 70)
                          .sort((a,b) => b.count-a.count);
  const primary   = saturated[0] ?? null;
  const supporting = saturated[1] ?? null;

  return {
    primary:    primary?.hex    ?? null,
    supporting: supporting?.hex ?? null,
    background: bg?.hex         ?? null,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
node --test tests/scraper.test.js
```

Expected: all 4 color tests pass.

- [ ] **Step 5: Commit**

```bash
git add scrape-sites.js tests/scraper.test.js
git commit -m "feat: implement and test color extraction"
```

---

### Task 3: Logo extraction

**Files:**
- Modify: `scrape-sites.js` (logo section)
- Modify: `tests/scraper.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/scraper.test.js`:

```js
import { extractLogoUrl } from '../scrape-sites.js';
import * as cheerio from 'cheerio';

test('finds logo img in nav', () => {
  const $ = cheerio.load(`<nav><img src="/img/logo.png" alt="Logo"></nav>`);
  assert.equal(extractLogoUrl($, 'https://example.nl'), 'https://example.nl/img/logo.png');
});

test('finds logo by class name', () => {
  const $ = cheerio.load(`<header><img class="site-logo" src="/logo.svg"></header>`);
  assert.equal(extractLogoUrl($, 'https://example.nl'), 'https://example.nl/logo.svg');
});

test('falls back to apple-touch-icon', () => {
  const $ = cheerio.load(`<head><link rel="apple-touch-icon" href="/icon.png"></head><nav><p>no img</p></nav>`);
  assert.equal(extractLogoUrl($, 'https://example.nl'), 'https://example.nl/icon.png');
});

test('returns null when no logo found', () => {
  const $ = cheerio.load(`<nav><a href="/">Home</a></nav>`);
  assert.equal(extractLogoUrl($, 'https://example.nl'), null);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
node --test tests/scraper.test.js 2>&1 | head -20
```

- [ ] **Step 3: Implement `extractLogoUrl`**

```js
export function extractLogoUrl($, baseUrl) {
  const base = new URL(baseUrl);
  const resolve = src => src ? new URL(src, base).href : null;

  // Search header/nav for img with logo in class/id/alt/src
  let src = null;
  $('header img, nav img').each((_, el) => {
    if (src) return;
    const attrs = [$(el).attr('class'), $(el).attr('id'),
                   $(el).attr('alt'), $(el).attr('src')].join(' ').toLowerCase();
    if (attrs.includes('logo')) src = $(el).attr('src');
  });
  if (src) return resolve(src);

  // Fallback: apple-touch-icon
  const icon = $('link[rel="apple-touch-icon"]').attr('href');
  return icon ? resolve(icon) : null;
}
```

- [ ] **Step 4: Run tests**

```bash
node --test tests/scraper.test.js
```

Expected: all logo tests pass.

- [ ] **Step 5: Commit**

```bash
git add scrape-sites.js tests/scraper.test.js
git commit -m "feat: implement and test logo URL extraction"
```

---

### Task 4: Menu extraction

**Files:**
- Modify: `scrape-sites.js` (menu section)
- Modify: `tests/scraper.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { extractMenu } from '../scrape-sites.js';

test('extracts flat menu from nav', () => {
  const $ = cheerio.load(`
    <nav><ul>
      <li><a href="/">Home</a></li>
      <li><a href="/over-ons">Over ons</a></li>
    </ul></nav>
  `);
  const menu = extractMenu($, 'https://example.nl');
  assert.equal(menu.length, 2);
  assert.equal(menu[0].label, 'Home');
  assert.equal(menu[0].href, 'https://example.nl/');
});

test('extracts one level of nesting', () => {
  const $ = cheerio.load(`
    <nav><ul>
      <li><a href="/behandelingen">Behandelingen</a>
        <ul>
          <li><a href="/behandelingen/implantaten">Implantaten</a></li>
          <li><a href="/behandelingen/bleaching">Bleaching</a>
            <ul><li><a href="/bleaching/laser">Laser</a></li></ul>
          </li>
        </ul>
      </li>
    </ul></nav>
  `);
  const menu = extractMenu($, 'https://example.nl');
  assert.equal(menu[0].label, 'Behandelingen');
  assert.equal(menu[0].children.length, 2);
  // grandchildren are flattened — no third level
  assert.equal(menu[0].children[0].children, undefined);
});

test('returns null when no nav found', () => {
  const $ = cheerio.load(`<div><a href="/">Home</a></div>`);
  assert.equal(extractMenu($, 'https://example.nl'), null);
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
node --test tests/scraper.test.js 2>&1 | head -20
```

- [ ] **Step 3: Implement `extractMenu`**

```js
export function extractMenu($, baseUrl) {
  const nav = $('nav').first();
  if (!nav.length) return null;
  const base = new URL(baseUrl);
  const resolve = href => href ? new URL(href, base).href : '#';

  function parseItems(ul, depth) {
    const items = [];
    ul.children('li').each((_, li) => {
      const a = $(li).children('a').first();
      if (!a.length) return;
      const item = { label: a.text().trim(), href: resolve(a.attr('href')) };
      if (depth < 1) {
        const childUl = $(li).children('ul').first();
        if (childUl.length) item.children = parseItems(childUl, depth + 1);
      }
      items.push(item);
    });
    return items;
  }

  return parseItems(nav.children('ul').first(), 0);
}
```

- [ ] **Step 4: Run tests**

```bash
node --test tests/scraper.test.js
```

Expected: all menu tests pass.

- [ ] **Step 5: Commit**

```bash
git add scrape-sites.js tests/scraper.test.js
git commit -m "feat: implement and test menu extraction"
```

---

### Task 5: Content + section analysis (Groq)

**Files:**
- Modify: `scrape-sites.js` (content section)

- [ ] **Step 1: Implement `stripPageText`**

Helper that reduces full HTML to key text only:

```js
function stripPageText($) {
  // Remove noise
  $('script, style, svg, noscript, iframe').remove();
  // Collect meaningful text from headings and paragraphs
  const parts = [];
  $('h1,h2,h3,p,li,address').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length > 10) parts.push(text);
  });
  return parts.join('\n').slice(0, 6000);
}
```

- [ ] **Step 2: Implement `analyseContent`**

```js
async function analyseContent(groqClient, pageText) {
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
  "sections": [],
  "content": {
    "headline": "...",
    "about": "...",
    "services": [],
    "team": [],
    "phone": "...",
    "email": "...",
    "address": "...",
    "hours": []
  }
}`;

  try {
    const response = await groqClient.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: 'Je antwoord bevat ALLEEN geldige JSON — geen uitleg, geen markdown.' },
        { role: 'user', content: prompt },
      ],
    });
    const raw = response.choices[0].message.content.trim()
      .replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/,'').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`    ⚠ LLM analysis failed: ${e.message}`);
    return { sections: null, content: null };
  }
}
```

- [ ] **Step 3: Verify manually with a test run**

Ensure `.env` contains `GROQ_API_KEY`, then run:

```bash
node -e "
import('./scrape-sites.js').then(async ({ analyseContent }) => {
  const { default: Groq } = await import('groq-sdk');
  // loadEnv is not exported — read key directly from process.env (set via .env loaded by shell or dotenv)
  const g = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const r = await analyseContent(g, 'Tandarts Amsterdam. Wij bieden implantaten en bleaching. Bel ons op 020-1234567.');
  console.log(JSON.stringify(r, null, 2));
});
"
```

If `GROQ_API_KEY` is not in the shell environment, prefix the command: `source .env && node -e ...` or add `loadEnv()` export to the script temporarily.

Expected: valid JSON with `sections` array and `content` object.

- [ ] **Step 4: Commit**

```bash
git add scrape-sites.js
git commit -m "feat: implement Groq content and section analysis"
```

---

### Task 6: Site fetcher + logo downloader

**Files:**
- Modify: `scrape-sites.js` (fetcher section)

- [ ] **Step 1: Implement `fetchSite`**

```js
async function fetchSite(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'Mozilla/5.0 (AutoSite scraper)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
```

- [ ] **Step 2: Implement `fetchCss`**

```js
async function fetchCss(html, baseUrl) {
  const $ = cheerio.load(html);
  const hrefs = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.includes('fonts.googleapis')) return;
    // resolve all hrefs (relative or absolute) to absolute URLs, then dedupe via Set
    try { hrefs.push(new URL(href, baseUrl).href); } catch { /* skip malformed */ }
  });
  const unique = [...new Set(hrefs)];
  const parts = await Promise.allSettled(
    unique.map(u => fetch(u, { signal: AbortSignal.timeout(5000) }).then(r => r.text()))
  );
  const inline = [];
  $('style').each((_, el) => inline.push($(el).text()));
  return [...parts.filter(p => p.status==='fulfilled').map(p => p.value), ...inline].join('\n');
}
```

- [ ] **Step 3: Implement `downloadLogo`**

```js
async function downloadLogo(logoUrl, destDir) {
  if (!logoUrl) return null;
  const res = await fetch(logoUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return null;
  const ext = path.extname(new URL(logoUrl).pathname) || '.png';
  const filename = `logo${ext}`;
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(destDir, filename), buffer);
  return filename;
}
```

- [ ] **Step 4: Implement `scrapeSite`**

```js
async function scrapeSite(prospect, groqClient) {
  const url = prospect.existing_url;
  const destDir = path.join(SCRAPES_DIR, prospect.id);
  fs.mkdirSync(destDir, { recursive: true });

  const html = await fetchSite(url);
  const $ = cheerio.load(html);

  const [cssText, logoUrl] = await Promise.all([
    fetchCss(html, url),
    Promise.resolve(extractLogoUrl($, url)),
  ]);

  const [colors, logo_file, analysis] = await Promise.all([
    Promise.resolve(extractColors(cssText)),
    downloadLogo(logoUrl, destDir),
    groqClient ? analyseContent(groqClient, stripPageText($)) : Promise.resolve({ sections: null, content: null }),
  ]);

  const scrapeJson = {
    url,
    scraped_at: new Date().toISOString(),
    logo_file,
    colors,
    menu: extractMenu($, url),
    sections: analysis.sections,
    content:  analysis.content,
  };

  fs.writeFileSync(path.join(destDir, 'scrape.json'), JSON.stringify(scrapeJson, null, 2));
  return scrapeJson;
}
```

- [ ] **Step 5: Commit**

```bash
git add scrape-sites.js
git commit -m "feat: implement site fetcher, CSS fetcher, and logo downloader"
```

---

### Task 7: Main loop + CSV integration

**Files:**
- Modify: `scrape-sites.js` (main section)

- [ ] **Step 1: Copy CSV helpers and loadEnv from build-sites.js**

Copy `parseCSV`, `parseCSVLine`, `serializeCSV`, `setField`, `saveCSV`, `loadEnv` verbatim from `build-sites.js` into `scrape-sites.js` (replacing the placeholder comments from Task 1).

- [ ] **Step 2: Implement `main`**

```js
async function main() {
  loadEnv();
  // Note: --playwright flag is parsed here for future use but Playwright integration
  // is out of scope for this iteration. The flag is a no-op until implemented.
  const usePlaywright = process.argv.includes('--playwright');
  const dummy         = process.argv.includes('--dummy');

  if (!dummy && !process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not set. Add to .env.');
  }

  const groqClient = dummy ? null : new Groq({ apiKey: process.env.GROQ_API_KEY });

  const records = parseCSV(fs.readFileSync(PROSPECTS_CSV, 'utf-8'));
  const pending = records.filter(r => r.scrape_status === 'pending' && r.existing_url);

  console.log(`\n🔍  AutoSite Scraper`);
  console.log(`    ${pending.length} prospect(s) to scrape\n`);

  if (pending.length === 0) {
    console.log('    Nothing to do — set scrape_status=pending and existing_url in prospects.csv');
    return;
  }

  for (const prospect of pending) {
    console.log(`\n── ${prospect.business_name} (${prospect.existing_url}) ──`);
    try {
      await scrapeSite(prospect, groqClient);
      console.log(`    ✓ Scraped → scrapes/${prospect.id}/`);
      setField(records, prospect.id, 'scrape_status', 'completed');
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}`);
      setField(records, prospect.id, 'scrape_status', 'failed');
    }
    saveCSV(records);
  }

  console.log('\n✓  Done\n');
}

main().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Test with --dummy flag (no API calls)**

Add `scrape_status=pending` and a real `existing_url` to one row in `prospects.csv`. Run:

```bash
node scrape-sites.js --dummy
```

Expected:
- `scrapes/{id}/scrape.json` created with `sections: null, content: null` (dummy skips Groq)
- Logo + colors extracted from live site
- `prospects.csv` updated: `scrape_status=completed`

- [ ] **Step 4: Commit**

```bash
git add scrape-sites.js prospects.csv
git commit -m "feat: implement main loop and CSV integration for scrape-sites.js"
```

---

### Task 8: Integrate scrape data into buildPrompt()

**Files:**
- Modify: `build-sites.js` (lines ~202–371, `buildPrompt` function)

- [ ] **Step 1: Add scrape loader helper to build-sites.js**

After the CSV helpers section, add:

```js
function loadScrapeData(id) {
  const scrapeFile = path.join(__dirname, 'scrapes', id, 'scrape.json');
  if (!fs.existsSync(scrapeFile)) return null;
  try { return JSON.parse(fs.readFileSync(scrapeFile, 'utf-8')); }
  catch { return null; }
}
```

- [ ] **Step 2: Modify `buildPrompt` to accept and inject scrape data**

Change signature from `buildPrompt(p)` to `buildPrompt(p, scrape)`. Add at the end of the prompt string, before the closing `Geef ALLEEN de JSON terug.` line:

```js
// Only inject sections + content into the prompt. Colors and menu are reserved
// for future theme/nav use and are intentionally excluded here.
const scrapeBlock = (scrape?.sections && scrape?.content)
  ? `\n## Huidige website van de praktijk\n
De prospect heeft een bestaande website met de volgende structuur en inhoud.
Gebruik dit als referentie — neem alle relevante informatie mee, maar herschrijf
alle teksten zodat ze professioneler, warmer en patiëntgerichter zijn.

Secties op de huidige site: ${JSON.stringify(scrape.sections)}

Huidige inhoud (ruw):
${JSON.stringify(scrape.content, null, 2)}\n`
  : '';
```

Insert `${scrapeBlock}` into the prompt template just before the closing instruction line.

- [ ] **Step 3: Update the call site in `generateSiteJson`**

In `generateSiteJson(client, prospect)`, load scrape data and pass it through:

```js
async function generateSiteJson(client, prospect) {
  const scrape = loadScrapeData(prospect.id);
  // ... existing code ...
  content: buildPrompt(prospect, scrape),  // pass scrape as second arg
```

- [ ] **Step 4: Test integration**

Set one prospect to `status=pending` that has a completed scrape. Run:

```bash
node build-sites.js --dummy
```

Expected: build completes, no errors. Then run with real Groq (if key available) and inspect the generated `site.json` — content should reflect the scraped site's structure.

- [ ] **Step 5: Commit**

```bash
git add build-sites.js
git commit -m "feat: inject scrape data into buildPrompt() when available"
```

---

### Task 9: Final validation

- [ ] **Step 1: Run full test suite**

```bash
node --test tests/scraper.test.js
```

Expected: all tests pass.

- [ ] **Step 2: Run end-to-end with a real prospect**

Set a prospect with a real dental website URL to `scrape_status=pending` and run:

```bash
node scrape-sites.js
```

Inspect `scrapes/{id}/scrape.json` and `scrapes/{id}/logo.*`. Verify:
- Colors extracted (or `null` with a clear reason)
- Logo downloaded (or `null`)
- Menu extracted
- `sections` and `content` populated by Groq

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat: site scraper module complete"
```
