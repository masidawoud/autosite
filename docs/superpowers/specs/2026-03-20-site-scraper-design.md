# Site Scraper Module — Design Spec

## What it does

Standalone script (`scrape-sites.js`) that reads `prospects.csv`, fetches each prospect's existing website, and extracts the data needed to generate a better new site. Output feeds into the existing `buildPrompt()` in `build-sites.js`.

## Trigger

```bash
node scrape-sites.js              # processes all scrape_status=pending
node scrape-sites.js --playwright # opt-in headless browser for all prospects in the run
```

Processes prospects where `scrape_status=pending`. Writes `scrape_status=completed` or `failed` back to CSV after each prospect. To re-scrape a single prospect: reset `scrape_status=pending` in the CSV (consistent with existing `status` field convention).

**Interaction with build pipeline:** `build-sites.js` proceeds with or without a scrape file. If `scrapes/{id}/scrape.json` exists, its data is injected into `buildPrompt()`. If not, build falls back to CSV-only data (current behaviour). `scrape_status=failed` does not block building.

## CSV changes

Two new columns:

| column | purpose |
|---|---|
| `existing_url` | prospect's current website URL |
| `scrape_status` | `pending` / `completed` / `failed` |

## Output

```
scrapes/
  1/
    scrape.json
    logo.png        ← extension matches source file
```

**`scrape.json` shape:**

```json
{
  "url": "https://tandartspraktijk-example.nl",
  "scraped_at": "2026-03-20T10:00:00Z",
  "logo_file": "logo.png",
  "colors": {
    "primary": "#1a4a8a",
    "supporting": "#3d7ab5",
    "background": "#ffffff"
  },
  "menu": [
    { "label": "Home", "href": "/" },
    { "label": "Behandelingen", "href": "/behandelingen", "children": [
      { "label": "Implantaten", "href": "/behandelingen/implantaten" }
    ]}
  ],
  "sections": ["hero", "about", "services", "team", "contact"],
  "content": {
    "headline": "...",
    "about": "...",
    "services": [{ "name": "...", "description": "..." }],
    "team": [{ "name": "...", "role": "..." }],
    "phone": "...",
    "email": "...",
    "address": "...",
    "hours": [{ "day": "Maandag", "time": "08:00–17:30" }]
  }
}
```

Any field that could not be extracted is set to `null` (not omitted).

## Extraction steps

### 1. Fetch + parse

`fetch` with a **10 second timeout** (`AbortSignal.timeout(10000)`). Parse with `cheerio`. On timeout, non-200, or parse failure → `scrape_status=failed`, log error, continue to next prospect.

### 2. Logo

Search in order:
1. `<header>` or `<nav>`: first `<img>` where `class`, `id`, `alt`, or `src` contains "logo" (case-insensitive)
2. `<link rel="apple-touch-icon">` href

**`og:image` is not used** — it typically returns promotional photos, not logos.

Resolve relative `src`/`href` values against the page's base URL before downloading. Download and save to `scrapes/{id}/logo.{ext}`. If no logo found: `logo_file: null`, continue (not a failure).

### 3. Color palette

Fetch `<link rel="stylesheet">` CSS files from `<head>` (skip external CDN URLs — fonts.googleapis.com, etc.). Also read `<style>` blocks inline. Concatenate all CSS text.

**Supported color formats:** hex (`#fff`, `#1a4a8a`), `rgb()`/`rgba()`, `hsl()`/`hsla()`, named colors (`white`, `black`, `transparent`). Convert all to hex for comparison.

**Ignored:** `linear-gradient()`, `url()`, CSS custom properties (`var(--x)`) — these are skipped, not dereferenced.

**Selection heuristic (raw property count):**
- Collect all color values from `color`, `background-color`, `background` (solid values only) properties
- Exclude white (`#ffffff`), near-white (lightness > 95%), black (`#000000`), near-black (lightness < 5%), and transparent
- **Background:** most-frequent color with lightness > 80%
- **Primary:** most-frequent color with saturation > 20% and lightness between 10–70%
- **Supporting:** second-most-frequent color meeting the same criteria as primary

If fewer than 3 distinct colors survive filtering: set missing fields to `null`. This is expected for sites using CSS custom properties heavily.

### 4. Menu structure

Find `<nav>`. Walk `<ul>/<li>/<a>` tree. Capture `label` (trimmed link text) and `href` (resolved to absolute URL). One level of nesting captured; deeper levels flattened into the parent. If no `<nav>` found: `menu: null`.

### 5. Content + section analysis (Groq)

Strip the page to key text: all heading tags (`h1`–`h3`), `<p>` text, nav labels, footer text. Remove scripts, styles, SVGs. Cap at 6000 characters.

**Prompt:**

```
Je bent een data-extractor voor tandartspraktijkwebsites.
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
{PAGE_TEXT}

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
}
```

**On LLM failure or unparseable JSON:** log warning, set `sections: null`, `content: null`. Still write `scrape.json` with logo + colors if those succeeded.

## `buildPrompt()` integration

In `build-sites.js`, after loading prospect data, check for `scrapes/{id}/scrape.json`. If found, append to the prompt:

```
## Huidige website van de praktijk

De prospect heeft een bestaande website met de volgende structuur en inhoud.
Gebruik dit als referentie — neem alle relevante informatie mee, maar herschrijf
alle teksten zodat ze professioneler, warmer en patiëntgerichter zijn.

Secties op de huidige site: {sections}

Huidige inhoud (ruw):
{JSON.stringify(content, null, 2)}
```

Fields injected: `sections` and `content` only. `colors` and `menu` are not injected into the content prompt — they inform theme/nav setup separately (future use).

## `--playwright` flag

When passed: uses Playwright (Chromium) instead of `fetch` for **all prospects** in the run. Requires manual install (`npm install playwright`). Viewport: 1280×800. Wait for `networkidle` before extracting. CSS colors extracted by intercepting network responses for `text/css` content type during page load — collect the raw CSS text and run the same color extraction logic as fetch mode (not `getComputedStyle`).

## New dependencies

- `cheerio` — HTML parsing (shared with `qualify-prospects.js`)
- `css-tree` — CSS parsing for color extraction
