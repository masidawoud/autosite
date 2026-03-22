# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AutoSite — Project Context

## What this is

AutoSite is an automated pipeline that generates and deploys production-ready websites for Dutch small businesses, starting with dental practices. The operator (us) runs the pipeline; clients get a live site and eventually a CMS to manage their content.

**Current status:** Pipeline is working end-to-end. 5 demo dental sites built and deployed to Cloudflare Pages.

---

## Tech stack

- **Astro 4.x** — static site generator, outputs plain HTML/CSS
- **CSS custom properties** — theming system, no Tailwind
- **Groq API** (llama-3.3-70b-versatile) — content generation during testing; swap to Claude for production
- **Cloudflare Pages** — hosting, deployed via Wrangler CLI
- **Cloudflare Worker** — shared contact form backend (`workers/forms-worker/`), routed by project name
- **Cloudflare KV** — per-client form config (recipient email, confirmation message)
- **Cloudflare Turnstile** — spam protection on contact forms (one site key for all clients)
- **Resend EU (Frankfurt)** — transactional email delivery for contact form submissions
- **Node.js (ESM)** — pipeline script
- **prospects.csv** — operator's source of truth for all prospects
- **Sveltia CMS** — client-facing CMS, served at `/admin` on each client's CF Pages site
- **Self-hosted Gitea on Hetzner VPS** — Git backend for Sveltia CMS; one repo per client; act runner handles CI/CD

---

## Repository structure

```
autosite/
  dental-template/          ← Astro project (the master template)
    src/
      components/           ← Nav, Hero, Quote, Features, Services,
                               About, Reviews, OpeningHours,
                               Vergoeding, Contact, Footer
      layouts/Layout.astro  ← injects CSS vars + Google Fonts from theme.json
      pages/index.astro     ← imports site.json, passes props to all components
      data/
        site.json           ← active content (overwritten per build)
        theme.json          ← active theme (overwritten per build)
        themes/
          warm-editorial.json   ← Cormorant Garamond + DM Sans, warm cream
          ocean-depths.json     ← Playfair Display + Inter, seafoam/navy
          tech-innovation.json  ← Space Grotesk + Inter, white/blue, sharp radius
  builds/                   ← generated per prospect (gitignored)
    1/                      ← cloned template + generated data + dist/
    2/
    ...
  build-sites.js            ← main pipeline script
  prospects.csv             ← all prospect data + build status
  .env                      ← GROQ_API_KEY, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
  package.json              ← single dep: groq-sdk
```

---

## How a site is built

```
prospects.csv (status=pending)
  → generate site.json via Groq API (prospect data used as prompt context)
  → build theme.json (load preset + inject brand_color_1/2 from CSV)
  → rsync dental-template → builds/{id}/ (symlink node_modules)
  → write site.json + theme.json into builds/{id}/src/data/
  → npm run build → builds/{id}/dist/
  → wrangler pages deploy dist/ → Cloudflare Pages
  → write deployed_url + status=completed back to CSV
```

---

## Pipeline commands

```bash
node build-sites.js                # full run: generate + build + deploy (pending only)
node build-sites.js --deploy-only  # skip content gen + Astro build, deploy existing dist/
node build-sites.js --dummy        # skip Groq API, fill site.json with placeholder data from CSV
```

To reprocess a prospect: set its `status` back to `pending` in prospects.csv.

`--dummy` is useful for testing the build + deploy flow without spending API credits. CSV status is still written back after each prospect.

## Template development commands

Run these from `dental-template/` to iterate on components:

```bash
cd dental-template
npm run dev      # starts Astro dev server with hot reload (uses dental-template/src/data/site.json + theme.json directly)
npm run preview  # preview the production build
npm run build    # build the template standalone (output in dental-template/dist/)
```

The dev server reads `dental-template/src/data/site.json` and `theme.json` directly, so edit those files to test different content or themes.

---

## prospects.csv schema

| column | purpose |
|---|---|
| `id` | build dir name (`builds/{id}/`) |
| `business_name`, `city`, `phone`, `email`, `address`, `postal_code` | injected into Groq prompt |
| `services`, `scraped_text` | additional prompt context |
| `brand_color_1`, `brand_color_2` | override accent colors in theme |
| `style_preset` | which theme preset to load (`warm-editorial` / `ocean-depths` / `tech-innovation`) |
| `status` | `pending` = process, `completed` = skip, `failed` = skip (reset to pending to retry) |
| `deployed_url` | written back after successful deploy |

---

## Theming system

- `theme.json` defines: `colors.*`, `fonts.*`, `radius.*`, and a `preset` string (used only for logging)
- `Layout.astro` builds a Google Fonts URL using `fonts.display_url` + `fonts.body_url` (these are the raw Google Fonts query strings, not family names)
- CSS vars use `fonts.display_family` / `fonts.body_family` (human-readable family names with fallbacks from `display_fallback` / `body_fallback`)
- `brand_color_1` from CSV overrides `colors.accent`; `brand_color_2` overrides `colors.accent_hover`; `accent_light` is auto-calculated via `lighten(brand_color_1, 0.85)`
- When adding a new theme preset, all four font fields (`display_family`, `display_url`, `body_family`, `body_url`) plus `display_fallback` and `body_fallback` are required

---

## Data-driven content

- All copy lives in `site.json` — hero, services, team, reviews, hours, vergoeding, contact, footer
- All components receive typed props from `index.astro`; nothing is hardcoded in components
- Image URLs are hardcoded in the Groq prompt template (hero uses Picsum, others use Unsplash)

---

## Known issues / decisions made

- **Hero image**: original Unsplash photo was deleted; replaced with `picsum.photos/seed/dental-hero/720/860`
- **Nav sticky background**: uses `var(--color-bg)` not a hardcoded color, so it respects the active theme
- **Wrangler 4.x**: requires `pages project create` before first deploy — pipeline does this automatically, ignores "already exists" error
- **Deployed URL**: always constructed as `https://{projectName}.pages.dev` — do NOT parse from wrangler output (which returns a hash-prefixed preview URL with invalid SSL)
- **CSV editing**: always use VS Code or plain text editor, never Excel/Numbers (causes semicolon delimiter issues)
- **Build dir naming**: prospect `id` from CSV is used as-is for the build directory name (`1`, `2`, ... not `001`)

---

## Planned next phase — CMS + section management

The architecture direction agreed on (not yet built):

**Separation of concerns:**
- `dental-template/` (operator-controlled) — all Astro components and layout
- Per-client GitHub repo (client-controlled via CMS) — only `site.json`, `theme.json`, `sections.json`

**Build flow (future):**
1. GitHub Action in each client repo triggered on CMS save
2. Clones latest `dental-template` from operator repo
3. Injects client's JSON files
4. Builds + deploys to Cloudflare Pages

**Section management:**
- `sections.json` will be an ordered array of `{ id, enabled }` objects
- `index.astro` iterates it to render components in the right order
- CMS exposes it as a drag-and-drop list
- Clients can add pre-designed sections from a library or reorder existing ones

**Template updates at scale:**
- Operator changes a component → pushes to `dental-template`
- One script triggers GitHub Actions across all client repos via GitHub API
- All sites rebuild with updated component; client content untouched

**CMS: Sveltia CMS + self-hosted Gitea on Hetzner VPS** — fully validated 2026-03-21. Clients log in with email/password only, no GitHub account needed. Zero consent screen confirmed (set `uid=0` on OAuth app via SSH+SQLite).

**Contact form: CF Worker + CF KV + Resend EU + Cloudflare Turnstile** — designed 2026-03-22. One shared Worker handles all clients, routed by `project_name`. Spec: `docs/superpowers/specs/2026-03-22-contact-form-design.md`.

**Full CMS integration** — designed 2026-03-22. Complete `config.yml` field definitions, 6 new section components (FAQ, Gallery, Before/After, Map, Emergency Banner, Pricing), dynamic section renderer, Nav/Footer client-editable. Spec: `docs/superpowers/specs/2026-03-22-cms-full-integration-design.md`.

**New pages** — designed 2026-03-22. Client-created Markdown pages at flat slugs (`/over-ons`), WYSIWYG body, per-page SEO fields. Spec: `docs/superpowers/specs/2026-03-22-new-pages-design.md`.

**TODO — implementation plans needed** (specs approved, plans not yet written):
1. Contact form: deploy CF Worker, provision KV, update `Contact.astro`
2. Full CMS integration: complete `config.yml`, new components, dynamic renderer, provisioning changes to `build-sites.js`
3. New pages: `[slug].astro`, content collection, deploy workflow update
4. Production provisioning: script full client onboarding into `build-sites.js` (Gitea user/repo/secrets, uid=0 patch, named Cloudflare Tunnel, CF Pages project)

---

