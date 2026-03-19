# AutoSite Pipeline — Risk Analysis & Hardening Design

**Date:** 2026-03-19
**Scope:** Option B — Structured pipeline hardening (short-term)
**Status:** Approved

---

## Context

AutoSite is a Node.js pipeline that generates and deploys dental practice websites for Dutch small businesses. It reads `prospects.csv` → calls Groq API for Dutch copy → builds with Astro → deploys to Cloudflare Pages.

**Current scale:** ~100 prospects in CSV within weeks; ~20 paying clients now, scaling to ~100 over 6+ months.

**Key constraints:**
- Generated team members and reviews are placeholder content — real content will be gathered from prospect websites before sites go live with clients.
- Currently auto-deploys without human review. Future: better LLM (Claude) + manual content review gate.
- `prospects.csv` is the single source of truth for all build state and deployed URLs.

---

## Risk Map

### Critical (affects live paying clients now)
1. No gate preventing a site with placeholder content from being handed to a paying client
2. No monitoring — downed sites go undetected
3. `prospects.csv` not yet backed up

### Important (operational fragility)
4. LLM can hallucinate business details (wrong phone/address in generated copy)
5. No pipeline audit trail
6. Build dir naming inconsistency (`001` vs `1`)

### Lower (future scale)
7. Sequential pipeline slow at 100+ prospects
8. Template updates don't propagate to existing client builds
9. Cloudflare Pages free tier limits

---

## Chosen Approach

**Option B — Structured pipeline hardening.** Targets the critical and important tiers with minimal added complexity. Option C (dashboard) deferred to mid-term once ~100 paying clients justify the overhead.

---

## Component Designs

### 1. Content Gate

**Problem:** Nothing prevents a site with generated fake reviews and invented team members from being treated as client-ready.

**Solution:** Add a `client_ready` column to `prospects.csv`. Values: empty (default) or `yes`. The pipeline **never writes to this column** — it is exclusively operator-controlled. The operator sets `client_ready=yes` only after verifying that real content (actual team, real reviews or removed placeholders) has been confirmed.

When Option C (dashboard) is built, `client_ready` becomes the primary filter for the client-facing view.

---

### 2. Generated Content Validation

**Problem:** Groq can hallucinate wrong business details or return structurally incomplete JSON that technically parses.

**Solution:** A `validateSiteJson(siteJson, prospect)` function runs immediately after `generateSiteJson()`, before anything is written to disk. Two checks:

**Field presence check:** Verify that `phone`, `email`, `address`, `business_name`, and `city` from the CSV each appear somewhere in the serialized JSON. On failure, throw with a descriptive message:
```
Validation failed: phone '020 123 4567' not found in generated content
```

**Structure check:** Verify all top-level keys are present and non-empty: `meta`, `business`, `hero`, `services`, `team`, `reviews`, `hours`, `vergoeding`, `contact`, `footer`. Guards against truncated LLM output that parses as valid JSON but is missing whole sections.

**Scope:** Does not apply to `--dummy` mode (dummy content is built from CSV directly and is always structurally valid).

On validation failure: the prospect is marked `failed` in the CSV; the pipeline logs the error and continues to the next prospect.

---

### 3. Post-Deploy Health Check

**Problem:** A successful Wrangler exit doesn't guarantee the site is actually serving. The pipeline marks prospects `completed` before verifying the deployed URL responds.

**Solution:** A `checkSiteHealth(url)` function runs immediately after `deploy()` returns the URL. It performs a single HTTP GET with a 10-second timeout and writes the result to a new `health` column in the CSV:

| Result | Value written |
|---|---|
| HTTP 200 | `ok` |
| Non-200 response | `error:{statusCode}` |
| No response within 10s | `timeout` |

The prospect status is still written as `completed` on health check failure — a network blip should not trigger a full re-run. The `health` column gives the operator immediate visibility into which sites need manual attention.

---

### 4. Pipeline Run Log

**Problem:** No record of what ran, when, and what the output was. Debugging relies entirely on terminal scrollback.

**Solution:** After each full pipeline run, append a structured Markdown entry to `pipeline-runs.log` at the repo root. The file is append-only — never overwritten. Commit it to git for a durable audit trail.

Each entry contains:
- Timestamp of the run
- Flags used (`--dummy`, `--deploy-only`, `--dry-run`, etc.)
- Per-prospect result: business name, status (`completed` / `failed`), deployed URL, health check result, error message if failed

Format (Markdown):
```markdown
## 2026-03-19 14:32:11 — full run

| Prospect | Status | URL | Health | Error |
|---|---|---|---|---|
| Tandarts X (Amsterdam) | completed | https://tandarts-x.pages.dev | ok | |
| Tandarts Y (Utrecht) | failed | | | Validation failed: phone not found |
```

---

### 5. `--dry-run` Mode

**Problem:** No way to test generate + build without deploying. Any run on a `pending` prospect deploys immediately and marks it `completed`, making safe experimentation impossible.

**Solution:** A `--dry-run` flag that runs the full pipeline (CSV parsing, Groq generation, theme building, template clone, Astro build) but skips `deploy()`. The CSV is **not written back**, so the prospect remains `pending` and can be re-run.

Terminal output makes the dry run explicit:
```
🦷  AutoSite Pipeline (dry-run)
── Tandartspraktijk X (Amsterdam) [warm-editorial] ──
    ✓ Content generated
    ✓ Theme ready
    ✓ Build complete
    ⚠ Dry run — skipping deploy. Built files at: builds/1/dist/
```

Can be combined with `--dummy` for zero-cost, zero-deploy testing of the full build flow.

---

### 6. `prospects.csv` Backup + Operational Hygiene

**Problem:** Losing or corrupting `prospects.csv` loses all build state and deployed URLs. There is also an existing build dir naming inconsistency (`001`–`005` legacy dirs vs plain integer dirs going forward).

**Backup solution:** At the end of every successful pipeline run, copy `prospects.csv` to `backups/prospects-YYYY-MM-DD-HH-mm.csv`. The `backups/` directory is gitignored (machine-local safety nets). The pipeline automatically deletes backups older than the 10 most recent.

**Build dir naming convention:** The `id` column in `prospects.csv` is used as-is as the build directory name. The existing `001`–`005` dirs are legacy — do not renumber them. All new prospects use plain integers (e.g., `6`, `7`, ...) continuing from the current highest numeric ID. Document this in CLAUDE.md.

---

## Updated `prospects.csv` Schema

| column | purpose |
|---|---|
| `id` | build dir name (`builds/{id}/`) — plain integer for new entries |
| `business_name`, `city`, `phone`, `email`, `address`, `postal_code` | injected into Groq prompt |
| `services`, `scraped_text` | additional prompt context |
| `brand_color_1`, `brand_color_2` | override accent colors in theme |
| `style_preset` | which theme preset to load |
| `status` | `pending` / `completed` / `failed` |
| `deployed_url` | written back after successful deploy |
| `health` | written back after health check: `ok` / `error:{code}` / `timeout` *(new)* |
| `client_ready` | operator-set: empty or `yes` — never written by pipeline *(new)* |

---

## Out of Scope (Option C — mid-term)

- Operator dashboard showing all prospects with status, URL, health, and `client_ready` flag
- Email or Slack alerting on health check failures
- Parallel pipeline processing
- Automated template propagation to existing client builds
