# CMS — TinaCMS Design Spec

## What we're building

A self-serve CMS for dental practice clients. Clients log in at their site's `/admin` route and can edit content, reorder sections, add new pages, manage navigation, and insert WYSIWYG content — without touching code or GitHub.

**Platform:** TinaCMS + Tina Cloud ($29/month flat, covers all client sites)
**Users:** Dental practice staff (non-technical, occasional use — a few times/month)

---

## System architecture

```
dental-template (operator repo)
  ↓ push component update → trigger script → repository_dispatch on all client repos
  ↓ all client sites rebuild automatically, client content untouched

Per-client GitHub repo (private, operator-owned)
  contains: site.json, theme.json, sections.json, menu.json, pages/
  ↓ client edits via TinaCMS editor → Tina Cloud commits to repo
  ↓ GitHub Action fires → clone dental-template → inject content → build → deploy

Tina Cloud
  handles: client auth (email/password invite), git bridge to client repo
  client never sees GitHub
```

**Key principle:** `dental-template` is entirely operator-controlled. Client repos contain only content files. Template updates and client edits never interfere.

---

## Content model

Five TinaCMS collections:

| Collection | What clients edit | File |
|---|---|---|
| Business Info | Name, address, phone, email, Google reviews | `site.json → business` |
| Theme | Accent color (picker), style preset (dropdown) | `theme.json` |
| Home Sections | Ordered list — drag to reorder, toggle enabled, add from library, edit per-section fields | `sections.json` + `site.json` |
| Pages | Title, slug, template (treatment/info/blank), template fields, optional WYSIWYG block | `pages/[slug].json` |
| Menu | Ordered nav items with one level of nesting (dropdown) — links to section anchors or page slugs | `menu.json` |

**WYSIWYG scope:** headings, paragraphs, bold/italic, images, bullet lists, simple tables. No custom HTML, no iframes.

**What clients cannot touch:** component HTML/CSS, font definitions, spacing system, image CDN URLs hardcoded in templates.

---

## Template changes (dental-template v2)

New/changed files:

| File | Change |
|---|---|
| `src/pages/index.astro` | Iterates `sections.json` instead of static imports — renders only enabled sections in order |
| `src/pages/[...slug].astro` | New — dynamic routing for client pages via `getStaticPaths` over `data/pages/` |
| `src/pages/admin/index.html` | New — TinaCMS editor entry point |
| `src/components/RichText.astro` | New — renders TinaCMS rich text JSON to HTML |
| `src/components/Nav.astro` | Reads `menu.json` instead of hardcoded links, supports one-level dropdown |
| `src/data/sections.json` | New — ordered array of `{ id, enabled }` |
| `src/data/menu.json` | New — nav structure |
| `src/data/pages/` | New — one JSON file per client page |
| `tina/config.ts` | New — full CMS schema (all 5 collections, Dutch labels) |

**Existing 11 section components:** unchanged — still receive props, just sourced from the new content model.

---

## Per-client setup

1. Run `build-sites.js` — generates initial `site.json` + `theme.json` via Groq
2. Create private GitHub repo, push initial content files + GitHub Action workflow
3. Set repo secrets — `TINA_CLIENT_ID`, `TINA_TOKEN` (per client); `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` inherited from GitHub Org (set once)
4. **Create Tina Cloud project manually** (dashboard only — no API available) — link to client repo, send client email invite (they set their own password via invite link)
5. Trigger first deploy via `repository_dispatch`

**GitHub Action trigger:** push to main (client edit) OR `repository_dispatch` (operator template update).

**Known limitation:** Tina Cloud has no management API. Steps 2–3 and 5 are scriptable via GitHub API; step 4 requires ~3 minutes in the Tina Cloud dashboard per client.

---

## Phasing

### Phase 1 — Trial spike *(free exit point)*
Integrate TinaCMS into `dental-template` on a `feature/tinacms` branch. Basic schema (business info + hero only). One demo Tina Cloud project + demo GitHub repo. GitHub Action end-to-end. **Do not merge to main until validated.**

Reversibility: delete branch, Tina Cloud project, demo repo. Zero impact on production.

### Phase 2 — Full single-page CMS
Complete schema for all 11 sections. Section ordering (`sections.json`). Menu management (`menu.json`). Clients manage all existing content.

Reversibility: git revert on `dental-template`. Client repos that have been onboarded need content files removed — manageable at low client count.

### Phase 3 — Multi-page + WYSIWYG
`[...slug].astro` dynamic routing. Page templates (treatment, info, blank). `RichText.astro`. Clients can create pages and use WYSIWYG blocks.

Reversibility: template changes are a clean git revert; client-created page files are orphaned and need manual cleanup per client.

### Phase 4 — Onboarding automation
Script automates steps 1–3 + 5 of per-client setup via GitHub API. Template update trigger script (`node trigger-rebuild.js`) dispatches `repository_dispatch` across all client repos. Manual Tina Cloud step remains.

---

## Secret management

| Secret | Scope | How set |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub Org | Once — inherited by all client repos |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Org | Once — inherited by all client repos |
| `TINA_CLIENT_ID` | Per client repo | Per client onboarding |
| `TINA_TOKEN` | Per client repo | Per client onboarding |
