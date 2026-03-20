# Prospect Qualification Tool — Design Spec

## What it does

Standalone script (`qualify-prospects.js`) that sits between an Apify scrape and `prospects.csv`. Takes a bulk list of dental practice URLs, analyses each site's structure, and outputs a staging CSV for manual review before any prospects enter the build pipeline.

## Flow

```
Apify export (CSV)
  → fetch site HTML (fetch + cheerio)
  → send extracted structure to Groq
  → Groq returns decision + reasons
  → write staging/YYYY-MM-DD-prospects.csv
  → operator reviews → copies approved rows into prospects.csv
```

## Input format

Apify export as CSV. Required columns: `business_name`, `url`. All other columns are passed through to the staging CSV as-is.

Run: `node qualify-prospects.js apify-export.csv`

## Site fetching

- `fetch` + cheerio: extracts nav links, page titles, h1s, internal link count, location keywords
- JS-heavy sites that fail to parse → flagged as `review`, `notes = "parse error: <reason>"`
- Sites that are unreachable (DNS failure, timeout, non-200, SSL error) → flagged as `review`, `notes = "fetch error: <reason>"`
- No Playwright — edge case not worth the dependency

## LLM classification

Model: `llama-3.3-70b-versatile` (Groq, already in stack)

The prompt instructs the LLM to assess the following signals (prompt must match this table exactly — the table is the source of truth):

| Signal | Pass | Fail |
|---|---|---|
| Location count | 1–3 | 4+ |
| Per-location complexity | simple info page | full sub-site per location |
| Treatment/service pages | many pages, consistent layout | bespoke layout per page |
| Custom infrastructure | none | patient portal, webshop, booking system |
| Overall structure | single coherent site | franchise / multi-brand |

Returns JSON:

```json
{
  "decision": "pass" | "fail" | "review",
  "confidence": "high" | "medium" | "low",
  "location_count": 2,
  "reasons": ["string", "..."],
  "notes": "one sentence summary"
}
```

**LLM error handling:** if the Groq call fails or returns unparseable JSON → write `review`, `confidence = "low"`, `notes = "LLM error: <reason>"`.

`review` = conflicting signals, insufficient structure extracted, or any error — surfaces to operator rather than auto-failing.

## Concurrency

Process prospects sequentially to avoid hitting Groq rate limits. For typical Apify exports (50–200 rows) this is fast enough.

## Output

`staging/YYYY-MM-DD-prospects.csv` — created automatically if the directory doesn't exist. If the file already exists it is overwritten.

All Apify input columns are passed through. Added columns:

| column | content |
|---|---|
| `decision` | pass / fail / review |
| `confidence` | high / medium / low |
| `location_count` | integer |
| `reasons` | JSON array string e.g. `["simpele locatiepagina","geen portaal"]` |
| `notes` | LLM free-text summary or error message |

## Column mapping: staging → prospects.csv

The staging CSV uses Apify field names. When copying rows into `prospects.csv`, map manually:

| staging (Apify) | prospects.csv |
|---|---|
| `business_name` | `business_name` |
| `url` | `existing_url` _(used for site fetching during qualification; carry forward for the planned prospect site analysis feature)_ |
| `city` | `city` |
| `phone` | `phone` |
| `email` | `email` |
| `address` | `address` |
| `postal_code` | `postal_code` |

Set `status = pending`, leave `brand_color_1`, `brand_color_2`, `style_preset`, `services`, `scraped_text` to fill in manually or leave blank for pipeline defaults.

## Flags

- `--dummy` — skips Groq API, writes `decision = review` with `notes = "dummy mode"` for all rows. Useful for testing the fetch + CSV output without spending API credits.

## New dependency

`cheerio` — HTML parsing only.
