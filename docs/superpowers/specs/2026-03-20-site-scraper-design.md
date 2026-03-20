# Site Scraper Module — Design Spec

## What it does

Standalone script (`scrape-sites.js`) that reads `prospects.csv`, fetches each prospect's existing website, and extracts the data needed to generate a better new site. Output feeds into the existing `buildPrompt()` in `build-sites.js`.

## Trigger

Runs independently of the build pipeline:
```bash
node scrape-sites.js              # processes all scrape_status=pending
node scrape-sites.js --playwright # opt-in headless browser for JS-heavy sites
```

Processes prospects where `scrape_status=pending`. Writes `scrape_status=completed` or `failed` back to CSV after each prospect (same pattern as `build-sites.js`).

## CSV changes

Two new columns:

| column | purpose |
|---|---|
| `existing_url` | prospect's current website URL |
| `scrape_status` | `pending` / `completed` / `failed` |

## Output

One directory per prospect: `scrapes/{id}/`

```
scrapes/
  1/
    scrape.json     ← all extracted data
    logo.png        ← downloaded logo file (extension varies)
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

## Extraction steps

### 1. Fetch + parse
`fetch` the URL, parse with `cheerio`. On parse failure or non-200 → `scrape_status=failed`.

### 2. Logo
- Search `<header>` / `<nav>` for `<img>` with "logo" in `class`, `id`, `alt`, or `src`
- Fallback: `<link rel="apple-touch-icon">`, `<meta property="og:image">`
- Download and save to `scrapes/{id}/logo.{ext}` (preserve original extension)
- Store filename in `scrape.json`

### 3. Color palette
- Fetch all `<link rel="stylesheet">` CSS files referenced in `<head>`
- Parse CSS text for `color`, `background-color`, `background` properties
- Bucket colors by lightness: background = lightest dominant color, primary = most-used saturated/dark color, supporting = second most-used mid-tone color
- Fallback if extraction yields fewer than 3 distinct colors: leave field null

### 4. Menu structure
- Find `<nav>` element, walk `<ul>/<li>/<a>` tree
- Capture `label` (link text) and `href` for each item
- One level of nesting captured; deeper levels flattened

### 5. Content + section analysis
Single Groq call (`llama-3.3-70b-versatile`). Send stripped page text (headings, paragraphs, nav — no scripts/styles). LLM returns:
- `sections`: ordered list of section types identified (hero, about, services, team, reviews, contact, etc.)
- `content`: raw copy per section — headline, about text, services list, team members, contact info, opening hours

Prompt instructs LLM to extract verbatim where possible, not improve copy (that happens later in `buildPrompt()`).

**LLM error handling:** on failure → log warning, leave `sections` and `content` null, still write `scrape.json` with logo + colors.

## Integration with build pipeline

`buildPrompt()` in `build-sites.js` checks for `scrapes/{id}/scrape.json` and injects the data as additional context:

```
The prospect's current site has the following structure and content.
Use this as a reference — capture everything relevant, but rewrite all
copy to be more engaging, modern and patient-focused.
```

If no scrape file exists, `buildPrompt()` falls back to current behaviour (CSV fields only).

## New dependencies

- `cheerio` — HTML parsing (shared with `qualify-prospects.js`)
- `css-tree` or plain regex — CSS color extraction (lightweight)

## `--playwright` flag

When passed, uses Playwright (Chromium) instead of `fetch` for the initial page load. Enables JS-rendered nav and computed CSS color extraction. Not installed by default — operator installs manually if needed (`npm install playwright`).
