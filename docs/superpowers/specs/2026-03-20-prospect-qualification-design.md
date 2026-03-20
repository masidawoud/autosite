# Prospect Qualification Tool — Design Spec

## What it does

Standalone script (`qualify-prospects.js`) that sits between an Apify scrape and `prospects.csv`. Takes a bulk list of dental practice URLs, analyses each site's structure, and outputs a staging CSV for manual review before any prospects enter the build pipeline.

## Flow

```
Apify export (CSV/JSON)
  → fetch site HTML (fetch + cheerio)
  → send extracted structure to Groq
  → Groq returns decision + reasons
  → write staging/YYYY-MM-DD-prospects.csv
  → operator reviews → copies approved rows into prospects.csv
```

## Site fetching

- `fetch` + cheerio: extracts nav links, page titles, h1s, internal link count, location keywords
- JS-heavy sites that fail to parse → automatically flagged as `review`
- No Playwright — edge case not worth the dependency

## LLM classification

Model: `llama-3.3-70b-versatile` (Groq, already in stack)

The LLM assesses:

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

`review` = conflicting signals or insufficient structure extracted — surfaces to operator rather than auto-failing.

## Output

`staging/YYYY-MM-DD-prospects.csv` — all Apify fields passed through, plus:

| column | content |
|---|---|
| `decision` | pass / fail / review |
| `confidence` | high / medium / low |
| `location_count` | integer |
| `reasons` | comma-separated |
| `notes` | LLM free-text summary |

## Handoff

Operator opens staging CSV, deletes disagreed fails, copies pass/review rows into `prospects.csv` with `status=pending`.

## New dependency

`cheerio` — HTML parsing only.
