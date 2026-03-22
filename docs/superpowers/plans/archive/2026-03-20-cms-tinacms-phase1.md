# TinaCMS Phase 1 — Trial Spike Implementation Plan

> ⚠️ **ABANDONED (2026-03-20), RE-EVALUATING (2026-03-21)** — Tina Cloud requires GitHub accounts (dealbreaker). Being reconsidered as TinaCMS self-hosted + alternative auth (Netlify Identity or similar) so clients use email/password only. Directus was built as replacement but parked on 2026-03-21 — self-hosted Postgres + schema management deemed overkill. The `feature/tinacms` branch is kept for reference.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate TinaCMS into `dental-template` on a `feature/tinacms` branch, wire a demo client repo + GitHub Action end-to-end, and validate the full edit → commit → build → deploy flow using a minimal schema (business info + hero only).

**Architecture:** TinaCMS is installed in `dental-template/` (operator repo). `tina/config.ts` defines the full `site.json` schema; only `business` and `hero` are visible in the editor (all other fields hidden to prevent data loss). The compiled admin bundle (output of `tinacms build`) is deployed as static files at `/admin` on the client site. Tina Cloud provides backend auth + git write access to the per-client content repo. A separate demo client GitHub repo holds `src/data/site.json`, `src/data/theme.json`, `config.json`, and the GitHub Action that clones `dental-template`, injects content, builds, and deploys.

**Tech Stack:** Astro 4.x, TinaCMS 1.x (`tinacms` + `@tinacms/cli`), Tina Cloud (manual setup), Cloudflare Pages (Wrangler 4.x), GitHub Actions, Node.js 20

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `dental-template/tina/config.ts` | CREATE | Full `site.json` schema; business + hero visible, rest hidden |
| `dental-template/package.json` | MODIFY | Add TinaCMS deps; update dev/build scripts |
| `dental-template/.gitignore` | MODIFY | Ignore `tina/__generated__/` and `public/admin/` |
| `dental-template/.env.example` | CREATE | Document required env vars for TinaCMS |
| `dental-template/astro.config.mjs` | NO CHANGE | No modifications needed |
| `dental-template/src/pages/index.astro` | NO CHANGE | Schema stays compatible with existing site.json |
| `demo-tandarts/src/data/site.json` | CREATE (client repo) | Client content — copy of dental-template default |
| `demo-tandarts/src/data/theme.json` | CREATE (client repo) | Client theme |
| `demo-tandarts/config.json` | CREATE (client repo) | Cloudflare Pages project name |
| `demo-tandarts/.github/workflows/deploy.yml` | CREATE (client repo) | Clone dental-template → inject content → build → deploy |

---

## Task 1: Create feature/tinacms branch

**Files:** none

- [ ] **Step 1: Create and switch to branch**

```bash
cd /Users/masidawoud/Dev/autosite
git checkout -b feature/tinacms
```

Expected: `Switched to a new branch 'feature/tinacms'`

- [ ] **Step 2: Verify branch**

```bash
git branch --show-current
```

Expected: `feature/tinacms`

---

## Task 2: Install TinaCMS packages

**Files:**
- Modify: `dental-template/package.json`
- Modify: `dental-template/package-lock.json` (auto-updated)

- [ ] **Step 1: Install TinaCMS packages**

```bash
cd /Users/masidawoud/Dev/autosite/dental-template
npm install --save-dev tinacms @tinacms/cli
```

Expected: packages added to `node_modules/`, `package-lock.json` updated.

- [ ] **Step 2: Verify packages in package.json**

After install, `dental-template/package.json` should have:
```json
{
  "devDependencies": {
    "@tinacms/cli": "^...",
    "tinacms": "^..."
  }
}
```

Run: `cat dental-template/package.json` and confirm both appear under `devDependencies`.

- [ ] **Step 3: Commit**

```bash
cd /Users/masidawoud/Dev/autosite
git add dental-template/package.json dental-template/package-lock.json
git commit -m "chore: install TinaCMS packages"
```

---

## Task 3: Update package.json scripts

**Files:**
- Modify: `dental-template/package.json`

The `dev` script must wrap Astro with `tinacms dev` so TinaCMS's local file-system adapter runs alongside Astro. The `build` script must run `tinacms build` first (generates `public/admin/`) then `astro build`.

- [ ] **Step 1: Update scripts in package.json**

Edit `dental-template/package.json` scripts section to:
```json
{
  "scripts": {
    "dev": "tinacms dev -c \"astro dev\"",
    "build": "tinacms build && astro build",
    "preview": "astro preview",
    "astro": "astro"
  }
}
```

- [ ] **Step 2: Verify dev script still runs**

```bash
cd /Users/masidawoud/Dev/autosite/dental-template
npm run dev
```

Expected: Astro dev server starts at `http://localhost:4321`. TinaCMS will fail to start its admin portion because `tina/config.ts` doesn't exist yet — that's expected. The Astro dev server should still start.

Stop the server (`Ctrl+C`).

- [ ] **Step 3: Commit**

```bash
cd /Users/masidawoud/Dev/autosite
git add dental-template/package.json
git commit -m "chore: update dev/build scripts for TinaCMS"
```

---

## Task 4: Update .gitignore and create .env.example

**Files:**
- Modify: `dental-template/.gitignore`
- Create: `dental-template/.env.example`

- [ ] **Step 1: Add TinaCMS generated files to .gitignore**

Edit `dental-template/.gitignore` to add:
```
dist/
node_modules/
.env
.env.*
!.env.example
.DS_Store
# TinaCMS generated files
tina/__generated__/
public/admin/
```

- [ ] **Step 2: Create .env.example**

Create `dental-template/.env.example`:
```
# TinaCMS — Tina Cloud credentials
# Get these from: https://app.tina.io → your project → Overview
#
# TINA_CLIENT_ID is NOT a secret — it's embedded in the compiled admin bundle.
# It is safe to expose publicly (scoped to your Tina Cloud project).
TINA_CLIENT_ID=

# TINA_TOKEN is a secret — used to authenticate TinaCMS build with Tina Cloud.
# Keep this out of version control. Add to GitHub Actions as a repository secret.
TINA_TOKEN=
```

- [ ] **Step 3: Commit**

```bash
cd /Users/masidawoud/Dev/autosite
git add dental-template/.gitignore dental-template/.env.example
git commit -m "chore: configure gitignore and env example for TinaCMS"
```

---

## Task 5: Create tina/config.ts — Phase 1 schema

**Files:**
- Create: `dental-template/tina/config.ts`

The schema covers the full `site.json` structure. Only `business` and `hero` objects are visible in the editor — all other top-level keys use `ui: { component: null }` which hides them from the UI but still writes them back on save (preserving data). The collection uses `allowedActions: { create: false, delete: false }` because `site.json` is a fixed single document — clients cannot create a second one.

- [ ] **Step 1: Create dental-template/tina directory and config file**

Create `dental-template/tina/config.ts` with the following content:

```typescript
import { defineConfig } from "tinacms";

export default defineConfig({
  branch: process.env.GITHUB_BRANCH || "main",
  clientId: process.env.TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },

  media: {
    tina: {
      mediaRoot: "",
      publicFolder: "public",
    },
  },

  schema: {
    collections: [
      {
        name: "siteContent",
        label: "Website inhoud",
        path: "src/data",
        match: { include: "site" },
        format: "json",
        ui: {
          // site.json is a fixed document — clients cannot create or delete it
          allowedActions: { create: false, delete: false },
          // Route editor to the homepage so preview shows the result
          router: () => "/",
        },
        fields: [
          // ── meta (hidden — not editable in Phase 1) ─────────────────────
          {
            type: "object",
            name: "meta",
            label: "Meta",
            ui: { component: null },
            fields: [
              { type: "string", name: "title", label: "Paginatitel" },
              { type: "string", name: "description", label: "Meta beschrijving" },
            ],
          },

          // ── business (PHASE 1 — visible) ────────────────────────────────
          {
            type: "object",
            name: "business",
            label: "Bedrijfsinformatie",
            fields: [
              { type: "string", name: "name", label: "Praktijknaam" },
              { type: "string", name: "city", label: "Stad" },
              { type: "string", name: "address", label: "Adres" },
              { type: "string", name: "postal_code", label: "Postcode" },
              { type: "string", name: "phone", label: "Telefoonnummer" },
              { type: "string", name: "email", label: "E-mailadres" },
              {
                type: "string",
                name: "google_reviews_score",
                label: "Google beoordelingsscore",
              },
              {
                type: "number",
                name: "google_reviews_count",
                label: "Aantal Google beoordelingen",
              },
              {
                type: "string",
                name: "google_reviews_url",
                label: "Google beoordelingen URL",
              },
            ],
          },

          // ── hero (PHASE 1 — visible) ─────────────────────────────────────
          {
            type: "object",
            name: "hero",
            label: "Hero sectie",
            fields: [
              { type: "string", name: "eyebrow", label: "Boven kop" },
              { type: "string", name: "headline", label: "Hoofdtitel" },
              { type: "string", name: "description", label: "Beschrijving" },
              { type: "string", name: "cta_primary", label: "Primaire knoptekst" },
              { type: "string", name: "cta_secondary", label: "Secundaire knoptekst" },
              { type: "string", name: "image_url", label: "Afbeelding URL" },
            ],
          },

          // ── quote (hidden) ───────────────────────────────────────────────
          {
            type: "object",
            name: "quote",
            label: "Quote",
            ui: { component: null },
            fields: [
              { type: "string", name: "text", label: "Tekst" },
              { type: "string", name: "author_name", label: "Auteursnaam" },
              { type: "string", name: "author_role", label: "Auteursfunctie" },
            ],
          },

          // ── features (hidden) ────────────────────────────────────────────
          {
            type: "object",
            name: "features",
            label: "Features",
            ui: { component: null },
            fields: [
              { type: "string", name: "eyebrow", label: "Boven kop" },
              { type: "string", name: "title", label: "Titel" },
              { type: "string", name: "subtitle", label: "Subtitel" },
              { type: "string", name: "image_url", label: "Afbeelding URL" },
              {
                type: "object",
                name: "items",
                label: "Items",
                list: true,
                fields: [
                  { type: "string", name: "icon", label: "Icoon" },
                  { type: "string", name: "title", label: "Titel" },
                  { type: "string", name: "desc", label: "Beschrijving" },
                ],
              },
            ],
          },

          // ── services (hidden) ────────────────────────────────────────────
          {
            type: "object",
            name: "services",
            label: "Diensten",
            ui: { component: null },
            fields: [
              { type: "string", name: "eyebrow", label: "Boven kop" },
              { type: "string", name: "title", label: "Titel" },
              { type: "string", name: "subtitle", label: "Subtitel" },
              {
                type: "object",
                name: "items",
                label: "Diensten",
                list: true,
                fields: [
                  { type: "string", name: "tag", label: "Tag" },
                  { type: "string", name: "title", label: "Titel" },
                  { type: "string", name: "desc", label: "Beschrijving" },
                  { type: "string", name: "image_url", label: "Afbeelding URL" },
                  { type: "string", name: "items", label: "Lijst items", list: true },
                  { type: "string", name: "cta", label: "CTA tekst" },
                ],
              },
            ],
          },

          // ── team (hidden) ────────────────────────────────────────────────
          {
            type: "object",
            name: "team",
            label: "Team",
            ui: { component: null },
            fields: [
              { type: "string", name: "eyebrow", label: "Boven kop" },
              { type: "string", name: "title", label: "Titel" },
              { type: "string", name: "subtitle", label: "Subtitel" },
              {
                type: "object",
                name: "members",
                label: "Teamleden",
                list: true,
                fields: [
                  { type: "string", name: "name", label: "Naam" },
                  { type: "string", name: "role", label: "Rol" },
                  { type: "string", name: "bio", label: "Bio" },
                  { type: "string", name: "image_url", label: "Foto URL" },
                ],
              },
            ],
          },

          // ── reviews (hidden) ─────────────────────────────────────────────
          {
            type: "object",
            name: "reviews",
            label: "Beoordelingen",
            ui: { component: null },
            fields: [
              { type: "string", name: "title", label: "Titel" },
              { type: "string", name: "subtitle", label: "Subtitel" },
              {
                type: "object",
                name: "items",
                label: "Beoordelingen",
                list: true,
                fields: [
                  { type: "string", name: "name", label: "Naam" },
                  { type: "number", name: "stars", label: "Sterren" },
                  { type: "string", name: "date", label: "Datum" },
                  { type: "string", name: "text", label: "Tekst" },
                ],
              },
            ],
          },

          // ── hours (hidden) ───────────────────────────────────────────────
          {
            type: "object",
            name: "hours",
            label: "Openingstijden",
            ui: { component: null },
            fields: [
              {
                type: "object",
                name: "items",
                label: "Dagen",
                list: true,
                fields: [
                  { type: "string", name: "day", label: "Dag" },
                  { type: "string", name: "time", label: "Tijd" },
                  { type: "boolean", name: "open", label: "Open" },
                ],
              },
            ],
          },

          // ── vergoeding (hidden) ──────────────────────────────────────────
          {
            type: "object",
            name: "vergoeding",
            label: "Vergoeding",
            ui: { component: null },
            fields: [
              { type: "string", name: "eyebrow", label: "Boven kop" },
              { type: "string", name: "title", label: "Titel" },
              { type: "string", name: "intro", label: "Introductie" },
              {
                type: "object",
                name: "blocks",
                label: "Blokken",
                list: true,
                fields: [
                  { type: "string", name: "title", label: "Titel" },
                  { type: "string", name: "text", label: "Tekst" },
                ],
              },
              { type: "string", name: "insurers", label: "Verzekeraars", list: true },
              { type: "string", name: "cta", label: "CTA tekst" },
            ],
          },

          // ── contact (hidden) ─────────────────────────────────────────────
          {
            type: "object",
            name: "contact",
            label: "Contact",
            ui: { component: null },
            fields: [
              { type: "string", name: "eyebrow", label: "Boven kop" },
              { type: "string", name: "title", label: "Titel" },
              { type: "string", name: "intro", label: "Introductie" },
            ],
          },

          // ── footer (hidden) ──────────────────────────────────────────────
          {
            type: "object",
            name: "footer",
            label: "Footer",
            ui: { component: null },
            fields: [
              { type: "string", name: "tagline", label: "Tagline" },
            ],
          },
        ],
      },
    ],
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/masidawoud/Dev/autosite/dental-template
npx tsc --noEmit
```

Expected: no errors. If there are TinaCMS type errors, run `npm run dev` first — TinaCMS generates types into `tina/__generated__/` on startup.

- [ ] **Step 3: Commit**

```bash
cd /Users/masidawoud/Dev/autosite
git add dental-template/tina/config.ts
git commit -m "feat: add TinaCMS config with Phase 1 schema (business + hero)"
```

---

## Task 6: Validate TinaCMS in local dev mode

Local mode (`npm run dev` without `TINA_CLIENT_ID`) runs TinaCMS with a filesystem adapter — edits write directly to `src/data/site.json`. No Tina Cloud account needed. This validates the schema is correct before connecting to the cloud.

**Files:** none (validation only)

- [ ] **Step 1: Start dev server in local mode**

```bash
cd /Users/masidawoud/Dev/autosite/dental-template
npm run dev
```

Expected: terminal output includes both:
- `astro dev server started` with a localhost URL (default: `http://localhost:4321`)
- TinaCMS local server started — look for a line like `TinaCMS serving on http://localhost:4001` (port may vary)

If TinaCMS prints a warning about missing `TINA_CLIENT_ID`, that's expected in local mode.

- [ ] **Step 2: Open the admin interface**

In local dev mode, TinaCMS serves its admin through its OWN dev server, not through Astro. Look at the terminal output for the TinaCMS URL — it is typically `http://localhost:4001` (not `http://localhost:4321/admin`).

Open that URL (e.g. `http://localhost:4001`) in a browser.

Expected: TinaCMS editor loads showing "Website inhoud" collection with two visible sections: **Bedrijfsinformatie** and **Hero sectie**. No other sections should be visible.

Note: `http://localhost:4321/admin` (Astro's URL) serves the PRODUCTION admin bundle (which requires Tina Cloud auth). For local editing, always use the TinaCMS dev server URL printed in the terminal.

- [ ] **Step 3: Make a test edit**

In the admin UI: click "Website inhoud" → edit the `business.name` field (change "De Glimlach" to "Test Praktijk") → click Save.

- [ ] **Step 4: Verify site.json was updated**

```bash
grep '"name"' /Users/masidawoud/Dev/autosite/dental-template/src/data/site.json | head -1
```

Expected: `"name": "Test Praktijk"` (under the `business` key).

Also verify no other fields were lost: the file should still contain `quote`, `features`, `services`, etc.

```bash
python3 -c "import json; d=json.load(open('src/data/site.json')); print(list(d.keys()))"
```

Run from `dental-template/`. Expected: `['meta', 'business', 'hero', 'quote', 'features', 'services', 'team', 'reviews', 'hours', 'vergoeding', 'contact', 'footer']`

- [ ] **Step 5: Revert test edit**

```bash
cd /Users/masidawoud/Dev/autosite/dental-template
git checkout -- src/data/site.json
```

- [ ] **Step 6: Stop dev server and commit**

```bash
cd /Users/masidawoud/Dev/autosite
git add dental-template/tina/
git commit -m "chore: add generated TinaCMS types"
```

(If `tina/__generated__/` is gitignored, no files to add. Skip if nothing to commit.)

---

## Task 7: Validate full build

**Files:** none (validation only)

- [ ] **Step 1: Run production build in local mode**

```bash
cd /Users/masidawoud/Dev/autosite/dental-template
npm run build
```

Expected:
- `tinacms build` runs first → generates `public/admin/index.html` and associated JS bundles
- `astro build` runs next → generates `dist/`
- No errors in either step

- [ ] **Step 2: Verify admin is in the build output**

```bash
ls /Users/masidawoud/Dev/autosite/dental-template/dist/admin/
```

Expected: `index.html` and bundled JS/CSS files.

- [ ] **Step 3: Preview the build**

```bash
cd /Users/masidawoud/Dev/autosite/dental-template
npm run preview
```

Open `http://localhost:4321/admin` in a browser. Expected: TinaCMS admin loads (it will prompt for Tina Cloud login since there's no local server in preview mode — that's expected).

Stop preview server.

- [ ] **Step 4: Commit build script confirmation**

No code changes needed. Tag this as validated:

```bash
cd /Users/masidawoud/Dev/autosite
git commit --allow-empty -m "chore: validate TinaCMS build pipeline works end-to-end locally"
```

---

## Task 8: Set up Tina Cloud (manual steps)

**This task requires browser access and cannot be automated.** Follow these steps exactly.

**Files:** none (external setup)

- [ ] **Step 1: Create Tina Cloud account**

Go to `https://app.tina.io`. Create an account or sign in.

- [ ] **Step 2: Create demo client GitHub repo**

On GitHub.com: create a NEW PRIVATE repository named `demo-tandarts` (owner: your GitHub account or org). Do not initialize with a README — you will push files manually in Task 9.

- [ ] **Step 3: Create Tina Cloud project**

In the Tina Cloud dashboard: click "New Project" → select "GitHub" → connect your GitHub account → select the `demo-tandarts` repository → complete project setup.

- [ ] **Step 4: Copy credentials**

After project creation, go to the project Overview page. Copy:
- **Client ID** (public, safe to expose) — looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Read-only token** → the token used in GitHub Actions for builds

Store these somewhere safe. You will use them in Tasks 9 and 10.

- [ ] **Step 5: Invite a test editor (optional but recommended for Phase 1 validation)**

In Tina Cloud project → Users → Invite. Add your own email. You will use this login to test editing in Task 11.

---

## Task 9: Create demo client GitHub repo content

The demo client repo mirrors the `src/data/` directory structure so TinaCMS paths align with what Tina Cloud reads/writes. Tina Cloud edits `src/data/site.json` in this repo based on the schema defined in `tina/config.ts`.

**Files (all in demo-tandarts repo, not autosite):**
- Create: `src/data/site.json`
- Create: `src/data/theme.json`
- Create: `config.json`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Clone the demo repo**

```bash
cd /tmp
git clone https://github.com/YOUR_GITHUB_USERNAME/demo-tandarts.git
cd demo-tandarts
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p src/data .github/workflows
```

- [ ] **Step 3: Copy content files from dental-template**

```bash
cp /Users/masidawoud/Dev/autosite/dental-template/src/data/site.json src/data/
cp /Users/masidawoud/Dev/autosite/dental-template/src/data/theme.json src/data/
```

- [ ] **Step 4: Create config.json**

Create `/tmp/demo-tandarts/config.json`:
```json
{ "project_name": "demo-tandarts" }
```

- [ ] **Step 5: Create GitHub Action workflow**

Create `/tmp/demo-tandarts/.github/workflows/deploy.yml`:

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
  repository_dispatch:
    types: [template-update]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout client repo
        uses: actions/checkout@v4

      - name: Clone dental-template (feature/tinacms)
        # TODO: change --branch feature/tinacms to main before production use
        run: |
          git clone https://github.com/masidawoud/autosite.git \
            --branch feature/tinacms \
            --depth 1 \
            dental-template-repo

      - name: Inject content files
        run: cp -r src/data/. dental-template-repo/dental-template/src/data/

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: dental-template-repo/dental-template/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: dental-template-repo/dental-template

      - name: Build
        run: npm run build
        working-directory: dental-template-repo/dental-template
        env:
          TINA_CLIENT_ID: ${{ vars.TINA_CLIENT_ID }}
          TINA_TOKEN: ${{ secrets.TINA_TOKEN }}

      - name: Read project name
        id: config
        run: |
          echo "project_name=$(python3 -c \"import json; print(json.load(open('config.json'))['project_name'])\")" \
            >> $GITHUB_OUTPUT

      - name: Create Cloudflare Pages project (idempotent)
        run: |
          npx wrangler pages project create "${{ steps.config.outputs.project_name }}" || true
        working-directory: dental-template-repo/dental-template
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy to Cloudflare Pages
        run: |
          npx wrangler pages deploy dist/ \
            --project-name "${{ steps.config.outputs.project_name }}"
        working-directory: dental-template-repo/dental-template
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

**Important — autosite repo must be public for this clone to work without authentication.** `dental-template/` contains no secrets (all secrets are env vars injected at build time), so making it public is safe. Before running this action:

```bash
# Verify autosite is set to Public in GitHub repo settings:
# github.com/masidawoud/autosite → Settings → Danger Zone → Change visibility
```

If you need to keep `autosite` private: create a [GitHub Deploy Key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) on the `autosite` repo with read-only access, add the private key as a secret named `AUTOSITE_DEPLOY_KEY` in `demo-tandarts`, and replace the clone step with:

```yaml
- name: Add autosite deploy key
  uses: webfactory/ssh-agent@v0.9.0
  with:
    ssh-private-key: ${{ secrets.AUTOSITE_DEPLOY_KEY }}
- name: Clone dental-template (feature/tinacms)
  run: |
    git clone git@github.com:masidawoud/autosite.git \
      --branch feature/tinacms \
      --depth 1 \
      dental-template-repo
```

**Phase 1 uses the public repo approach (simpler).** The deploy key approach is documented here for production.

- [ ] **Step 6: Push to demo repo**

```bash
cd /tmp/demo-tandarts
git add .
git commit -m "feat: initial demo client setup"
git push origin main
```

---

## Task 10: Configure GitHub secrets in demo repo

**Files:** none (GitHub UI configuration)

All secrets are set via GitHub repo settings UI: `https://github.com/YOUR_GITHUB_USERNAME/demo-tandarts/settings/secrets/actions`

- [ ] **Step 1: Add CLOUDFLARE_API_TOKEN secret**

GitHub repo settings → Secrets and variables → Actions → New repository secret:
- Name: `CLOUDFLARE_API_TOKEN`
- Value: your Cloudflare API token (same one used by autosite's `.env`)

(If set at org level, skip — inherited automatically.)

- [ ] **Step 2: Add CLOUDFLARE_ACCOUNT_ID secret**

- Name: `CLOUDFLARE_ACCOUNT_ID`
- Value: your Cloudflare account ID

(If set at org level, skip.)

- [ ] **Step 3: Add TINA_TOKEN secret**

- Name: `TINA_TOKEN`
- Value: the Tina Cloud token copied in Task 8 Step 4

- [ ] **Step 4: Add TINA_CLIENT_ID variable (non-secret)**

GitHub repo settings → Secrets and variables → Actions → Variables tab → New repository variable:
- Name: `TINA_CLIENT_ID`
- Value: the Tina Cloud client ID copied in Task 8 Step 4

Variables (not secrets) are appropriate here because `TINA_CLIENT_ID` is public by design — it ends up in the compiled admin bundle that ships to browsers.

---

## Task 11: Validate GitHub Action build

**Files:** none (validation only)

- [ ] **Step 1: Trigger the action manually**

On GitHub: go to `demo-tandarts` repo → Actions → "Build and Deploy" → "Run workflow" → Run workflow on `main`.

Alternatively, make a trivial commit to trigger it:
```bash
cd /tmp/demo-tandarts
echo "" >> config.json
git add config.json
git commit -m "chore: trigger test build"
git push
```

- [ ] **Step 2: Monitor action run**

On GitHub Actions page: watch the run. Expected timeline (~2-3 min):
1. Checkout ✅
2. Clone dental-template ✅
3. Inject content ✅
4. Install (may take 1-2 min first run; cached on repeat) ✅
5. Build (tinacms build + astro build) ✅
6. Deploy ✅

If step 5 fails with `TINA_CLIENT_ID not set`: verify the variable is set as a VARIABLE (not secret) in repo settings. Variables use `vars.` context; secrets use `secrets.` context.

If step 6 fails with Cloudflare auth error: verify `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets are set correctly.

- [ ] **Step 3: Verify deployed URL**

Expected deployed URL: `https://demo-tandarts.pages.dev`

Open in browser. Confirm the site loads and looks correct (all sections visible, content matches `src/data/site.json`).

- [ ] **Step 4: Verify /admin loads**

Open `https://demo-tandarts.pages.dev/admin` in browser.

Expected: TinaCMS admin UI loads and prompts for Tina Cloud login.

---

## Task 12: Validate full edit → commit → deploy flow

**Files:** none (validation only — this is the Phase 1 acceptance test)

- [ ] **Step 1: Log in to admin**

Open `https://demo-tandarts.pages.dev/admin`. Log in with the Tina Cloud editor account you invited in Task 8 Step 5.

Expected: TinaCMS editor loads, showing the "Website inhoud" collection with "Bedrijfsinformatie" and "Hero sectie" sections visible.

- [ ] **Step 2: Make a test edit**

Edit `business.name` (change from "De Glimlach" to "Demo Tandartspraktijk") → click Save.

- [ ] **Step 3: Verify Tina Cloud committed to the demo repo**

On GitHub: go to `demo-tandarts` repo → commits. Expected: a new commit from the TinaCMS bot modifying `src/data/site.json`.

- [ ] **Step 4: Verify GitHub Action triggered**

On GitHub Actions: a new "Build and Deploy" run should have started automatically, triggered by the push from Tina Cloud.

- [ ] **Step 5: Verify deployed site reflects the edit**

After the action completes (~2-3 min), reload `https://demo-tandarts.pages.dev`.

Expected: the site now shows "Demo Tandartspraktijk" wherever the business name appears (nav, contact section, footer).

**Phase 1 is validated when this step passes.**

---

## Task 13: Commit plan-validated state

- [ ] **Step 1: Final commit on feature/tinacms**

```bash
cd /Users/masidawoud/Dev/autosite
git add \
  dental-template/tina/config.ts \
  dental-template/package.json \
  dental-template/package-lock.json \
  dental-template/.gitignore \
  dental-template/.env.example
git status
```

Review staged files. Confirm only the listed files are staged — avoid accidentally committing unrelated changes.

```bash
git commit -m "feat: TinaCMS Phase 1 spike — full schema + build pipeline validated"
```

- [ ] **Step 2: Do NOT merge to main**

Phase 1 exists on `feature/tinacms` until explicitly validated and approved. Leave the branch as-is. Merging to main is a separate decision outside this plan.

---

## Phase 1 Exit Criteria

Before considering Phase 1 complete:

| Check | Expected |
|-------|----------|
| `npm run dev` starts | Both TinaCMS and Astro start without errors |
| Local admin (TinaCMS dev server URL) | Shows Bedrijfsinformatie + Hero sectie only |
| Local save preserves all site.json fields | `python3 -c "import json; print(list(json.load(open('src/data/site.json')).keys()))"` shows all 12 top-level keys |
| `npm run build` succeeds | `dist/admin/index.html` exists + full site in `dist/` |
| GitHub Action build passes | Green checkmark on demo-tandarts Actions page |
| `/admin` on deployed site | TinaCMS editor loads and prompts for login |
| Full edit → commit → deploy | Change in TinaCMS → Tina Cloud commit → Action re-fires → deployed site updated |

---

## Rollback

Phase 1 is fully reversible:
- Delete `feature/tinacms` branch → zero impact on `main` or any live site
- Delete Tina Cloud project (dashboard)
- Delete `demo-tandarts` GitHub repo
- Existing Cloudflare Pages projects are unaffected
