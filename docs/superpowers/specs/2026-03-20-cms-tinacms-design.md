# CMS — TinaCMS Design Spec

> ⚠️ **ABANDONED (2026-03-20), ACTIVE SPIKE (2026-03-21)** — Tina Cloud requires GitHub accounts (dealbreaker). Now being implemented as TinaCMS self-hosted with email/password auth via `tinacms-authjs` (`UsernamePasswordAuthJSProvider`) — no GitHub account required for clients. Backend runs as a separate Node.js service on Fly.io; static Astro site stays on Cloudflare Pages. Directus was built as replacement but parked on 2026-03-21 — self-hosted Postgres + schema management overkill at current scale. Implementation plan: `docs/superpowers/plans/2026-03-21-cms-tinacms-authjs.md`.

## What we're building

A self-serve CMS for dental practice clients. Clients log in at their site's `/admin` route and can edit content, reorder sections, add new pages, manage navigation, and insert WYSIWYG content — without touching code or GitHub.

**Platform:** TinaCMS + Tina Cloud ($29/month flat, covers all client sites)
**Users:** Dental practice staff (non-technical, occasional use — a few times/month)

---

## System architecture

```
dental-template (public operator repo — no sensitive data)
  ↓ push component update → node trigger-rebuild.js
    → GitHub API: repository_dispatch on all client repos
    → all GitHub Actions fire → all client sites rebuild, client content untouched

Per-client GitHub repo (private, operator-owned)
  contains: site.json, theme.json, sections.json, menu.json, pages/, config.json
  ↓ client edits via TinaCMS editor → Tina Cloud commits to repo
  ↓ GitHub Action fires:
      1. checkout client repo
      2. git clone dental-template (public, no auth needed)
      3. copy content files into dental-template/src/data/
      4. npm ci (cached)
      5. npm run build
      6. wrangler pages deploy dist/ --project-name from config.json

Tina Cloud ($29/mo)
  handles: client auth (email/password via invite link), git bridge to client repo
  client never sees GitHub
```

**Key principle:** `dental-template` is entirely operator-controlled and public. Client repos contain only content files. Template updates and client edits never interfere.

---

## Content model

Five TinaCMS collections:

| Collection | What clients edit | File |
|---|---|---|
| Business Info | Name, address, phone, email, Google reviews | `site.json → business` |
| Theme | Accent color (picker), style preset (dropdown) | `theme.json` |
| Home Sections | Ordered list — drag to reorder, toggle enabled, add from library | `sections.json` |
| Site Content | Per-section fields (hero, services, team, etc.) | `site.json` |
| Pages | Title, slug, template (treatment/info/blank), template fields, optional WYSIWYG block | `pages/[slug].json` |
| Menu | Ordered nav items with one level of nesting (dropdown) | `menu.json` |

**`sections.json` structure:** ordered array of `{ id, enabled }` only — e.g. `[{ "id": "hero", "enabled": true }, ...]`. Per-section copy lives in `site.json` as today, keyed by section id. These are two separate TinaCMS collections presented as two tabs in the editor.

**`TINA_CLIENT_ID` is public:** it ends up in the static Astro build output by design (TinaCMS requires it in the frontend bundle). Do not treat it as a secret — it is scoped to the specific Tina Cloud project and is safe to expose.

**WYSIWYG scope:** headings, paragraphs, bold/italic, images, bullet lists, simple tables. No custom HTML, no iframes.

**Slug uniqueness:** enforce unique slugs in the TinaCMS Pages schema — TinaCMS does not enforce this by default. Document it as a constraint in the schema definition.

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
| `src/data/sections.json` | Default fallback — overwritten by client repo version during GitHub Action inject step |
| `src/data/menu.json` | Default fallback — overwritten during inject step |
| `src/data/pages/` | Default empty — client page files copied in during inject step |
| `tina/config.ts` | New — full CMS schema (6 collections, Dutch labels, treatment/info/blank page templates with distinct field sets) |

**Existing 11 section components:** unchanged — still receive props, just sourced from the new content model.

---

## Per-client setup

Each client repo contains a `config.json` at root:
```json
{ "project_name": "tandarts-amsterdam" }
```
The GitHub Action reads this to determine the Cloudflare Pages project name.

**Onboarding steps:**
1. Run `build-sites.js` — generates initial `site.json` + `theme.json` via Groq
2. Create private GitHub repo, push initial content files + `config.json` + GitHub Action workflow
3. Set repo secrets — `TINA_TOKEN` (per client); org-level secrets inherited automatically (see below)
4. **Create Tina Cloud project manually** (dashboard only — no API available) — link to client repo, copy `TINA_CLIENT_ID` into client repo as a non-secret env var in the Action, send client email invite (they set their own password via invite link)
5. Trigger first deploy via `repository_dispatch`

**`trigger-rebuild.js`:** reads a `clients.json` file in the operator repo (list of `{ repo, owner }` entries), calls GitHub API `POST /repos/{owner}/{repo}/dispatches` with event type `template-update` for each. Requires a GitHub token with `repo` scope stored in operator's local `.env`. Client repos are added to `clients.json` during onboarding.

---

## Secret management

| Secret | Scope | How set |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | GitHub Org | Once — inherited by all client repos |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Org | Once — inherited by all client repos |
| `TINA_TOKEN` | Per client repo | Per client onboarding |
| `TINA_CLIENT_ID` | Action env var (non-secret) | Per client onboarding — safe to expose |

---

## Phasing

### Phase 1 — Trial spike *(free exit point)*
Integrate TinaCMS into `dental-template` on a `feature/tinacms` branch. Basic schema (business info + hero only). One demo Tina Cloud project + demo GitHub repo. Full GitHub Action end-to-end. **Do not merge to main until validated.**

Reversibility: delete branch, Tina Cloud project, demo repo. Zero impact on production.

### Phase 2 — Full single-page CMS
Complete schema for all 11 sections. Section ordering (`sections.json`). Menu management (`menu.json`). Clients manage all existing content.

Reversibility: `git revert` on `dental-template` (clean). Per-client repos that have been onboarded also need `sections.json` and `menu.json` removed — these are separate repos and must be cleaned up independently. Manageable at low client count.

### Phase 3 — Multi-page + WYSIWYG
`[...slug].astro` dynamic routing. Page templates (treatment, info, blank — each with distinct TinaCMS field sets). `RichText.astro`. Clients can create pages and use WYSIWYG blocks.

Reversibility: template revert is clean; client-created `pages/` files are orphaned in their repos and need manual cleanup per client.

### Phase 4 — Onboarding automation
Script automates steps 1–3 + 5 of per-client setup via GitHub API. `trigger-rebuild.js` for template update propagation across all client repos. Manual Tina Cloud dashboard step remains.
