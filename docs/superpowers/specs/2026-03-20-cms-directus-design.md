# CMS — Directus Design Spec

> Replaces the abandoned TinaCMS approach (`2026-03-20-cms-tinacms-design.md`).
> TinaCMS required clients to have GitHub accounts — dealbreaker for non-technical users.

## What we're building

A self-serve CMS for dental practice clients. Clients log in at `directus.yourdomain.com/admin` with email and password, edit their site content, manage pages, and add/reorder prebuilt sections — without touching code or GitHub.

**Platform:** Directus (self-hosted, open-source, BSL 1.1 — free for orgs under $5M revenue)
**Users:** Dental practice staff (non-technical, occasional use)
**Auth:** Email + password only. No GitHub account required.

---

## System architecture

```
Directus (Fly.io Phase 1 ~$5-6/mo, Railway ~$10/mo production)
  ├── PostgreSQL DB
  ├── Admin UI at directus.yourdomain.com/admin
  ├── REST API (content read/write for pipeline)
  └── Flow: on content save → POST GitHub API → workflow_dispatch

GitHub Action (dental-template repo — deploy.yml)
  ├── Triggered by: Directus webhook (workflow_dispatch with client_id input)
  ├── Fetches: site_configs + pages + blocks from Directus REST API
  ├── Writes: site.json + theme.json → dental-template/src/data/
  ├── Writes: pages JSON → dental-template/src/data/pages/
  ├── Runs: astro build
  └── Deploys: wrangler pages deploy → Cloudflare Pages

build-sites.js (existing pipeline — minimal changes)
  ├── Still generates content via Groq (unchanged)
  ├── After generation: POST to Directus API to create site_configs record
  └── Creates Directus user + links to record (onboarding automation — Phase 3)
```

**Key principle:** `dental-template` and all Astro components are untouched. The GitHub Action fetches content from Directus and writes the same JSON files the template already reads. No per-client GitHub repos needed.

---

## Content model

### `site_configs` (global settings per client)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `client_id` | string (unique) | Matches Cloudflare Pages project name e.g. `tandarts-amsterdam` |
| `owner` | M2O → directus_users | Links record to the client's Directus login |
| `business_name` | string | |
| `phone` | string | |
| `email` | string | |
| `address` | string | |
| `city` | string | |
| `postal_code` | string | |
| `theme_preset` | enum | `warm-editorial` / `ocean-depths` / `tech-innovation` |
| `theme_accent_1` | string | Hex color — overrides `colors.accent` in theme preset |
| `theme_accent_2` | string | Hex color — overrides `colors.accent_hover` |

`theme.json` is reconstructed at build time: the GitHub Action loads the preset file from `dental-template/src/data/themes/` and overrides accent colors from `theme_accent_1/2`.

### `pages`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `site` | M2O → site_configs | Scopes page to a client |
| `title` | string | |
| `slug` | string | Unique per site. `home` = homepage |
| `status` | enum | `published` / `draft` |
| `blocks` | M2A | Ordered list of section blocks (drag-to-reorder in Directus UI) |

### Blocks (M2A — one collection per section type)

Each block type is a separate Directus collection. In the admin UI, clients click **"+ Add block"**, pick a type, fill in typed fields. Drag to reorder.

Block types are defined during implementation based on the 11 existing Astro components (`Hero`, `About`, `Services`, `Team`, `Reviews`, `Contact`, `OpeningHours`, `Vergoeding`, `Features`, `Quote`, `Footer`). Each block collection's fields map directly to the props that component already accepts.

A `block_text` collection (WYSIWYG rich text) is included for free-form content pages.

**Junction table** (`page_section_blocks`):

| Field | Type |
|---|---|
| `id` | UUID |
| `page_id` | M2O → pages |
| `sort` | integer (drag-to-reorder) |
| `collection` | string (block type name) |
| `item` | UUID (FK to block record) |

**Block permission workaround — owner field:**
Directus permission filters cannot traverse multi-hop relationships (e.g. `block_hero → junction → page → site_configs → owner`). To enforce row-level isolation on block collections, each `block_*` collection carries a redundant `owner` field (M2O → directus_users), populated automatically on creation. Client role permission for all `block_*` collections: `WHERE owner = $CURRENT_USER`. This is an explicit design decision, not an oversight.

---

## Auth & per-client isolation

```
Roles:
  ├── Administrator — operator only, full access to all records
  └── Client — one role shared by all client users, row-level scoped

Client role permissions:
  ├── site_configs:        read + update WHERE owner = $CURRENT_USER
  ├── pages:               CRUD WHERE site.owner = $CURRENT_USER
  ├── page_section_blocks: CRUD WHERE page_id.site.owner = $CURRENT_USER
  └── block_*:             CRUD WHERE owner = $CURRENT_USER (redundant owner field — see above)
```

Clients see only their own data — other clients' records are invisible at the API level, not just the UI.

**Onboarding a new client (manual — Phase 1 and 2):**
1. Run `build-sites.js` → generates initial content via Groq
2. POST to Directus API → creates `site_configs` record with generated content
3. Create Directus user via API (email + Client role + link to `site_configs` record)
4. Use Directus built-in invite flow → client receives email, sets own password
5. Trigger first deploy via GitHub API `workflow_dispatch`

---

## Build trigger flow

```
Client saves content in Directus
  → Directus Flow (trigger: on item update/create for site_configs, pages, block_*)
  → Resolve client_id from affected record
  → POST https://api.github.com/repos/{operator}/dental-template/actions/workflows/deploy.yml/dispatches
      headers: Authorization: Bearer {DIRECTUS_GITHUB_PAT}   ← PAT stored in Directus env, not Actions
      body: { "ref": "main", "inputs": { "client_id": "tandarts-amsterdam" } }

GitHub Action (deploy.yml) receives client_id input:
  1. GET {DIRECTUS_URL}/items/site_configs?filter[client_id][_eq]={client_id}&fields=*
  2. GET {DIRECTUS_URL}/items/pages?filter[site.client_id][_eq]={client_id}
       &fields=*,blocks.sort,blocks.collection,blocks.item:block_hero.*,blocks.item:block_services.*,...
       (M2A requires explicit per-collection field selectors — `blocks.*.*` does not hydrate block data)
  3. Reconstruct site.json + theme.json from Directus response
  4. Write to dental-template/src/data/
  5. npm run build
  6. wrangler pages deploy dist/ --project-name {client_id} --branch main
```

**One GitHub Action, all clients.** Only `client_id` changes per run. Parallel deploys are safe — each run operates in its own workspace.

**Known limitation — concurrent saves:** If a client saves multiple fields in quick succession, each save dispatches a separate `workflow_dispatch`. GitHub Actions queues all of them and runs them serially. Redundant but harmless for Phase 1. A debounce mechanism (skip dispatch if a run for this `client_id` is already queued/running) should be added before production scale.

**Secrets and credentials:**

| Where | Name | Purpose |
|---|---|---|
| Directus env var | `DIRECTUS_GITHUB_PAT` | GitHub fine-grained PAT (actions: write scope) — used by Directus Flow to call GitHub API |
| GitHub Actions secret | `DIRECTUS_TOKEN` | Read-only Directus API token — fetches content at build time |
| GitHub Actions secret | `DIRECTUS_URL` | Base URL of the Directus instance e.g. `https://directus.yourdomain.com` |
| GitHub Actions secret | `CLOUDFLARE_API_TOKEN` | Wrangler deploy |
| GitHub Actions secret | `CLOUDFLARE_ACCOUNT_ID` | Wrangler deploy |
| GitHub Actions (auto) | `GITHUB_TOKEN` | Auto-provisioned by GitHub — used within the Action runner for checkout etc. Not the same as `DIRECTUS_GITHUB_PAT` |

---

## Hosting

### Phase 1 — Fly.io (~$5–6/mo)
- Directus app: shared-cpu-1x, 512MB RAM (~$3.32/mo)
- PostgreSQL app: shared-cpu-1x, 256MB RAM (~$1.94/mo)
- Persistent volume: 1GB (~$0.15/mo)
- No spin-down — machines stay running
- Credit card required

### Production — Railway (~$10/mo)
- Directus service + PostgreSQL service
- One-click provisioning via Railway's Directus template
- Migration from Fly.io: Directus schema/data export → import into Railway instance

---

## Phasing

### Phase 1 — Proof of concept *(low-cost exit point, ~$5–6/mo)*
Directus on Fly.io. `site_configs` collection only. Client role with row-level permissions. One demo client end-to-end: Directus save → GitHub Action → Cloudflare Pages deploy. Manual onboarding.

**Reversibility:** delete Fly.io app, delete GitHub Action workflow. Zero impact on existing pipeline or production sites.

### Phase 2 — Multi-page + blocks
`pages` collection + M2A blocks. Block collections for all 11 existing section types + `block_text` (WYSIWYG). `[...slug].astro` dynamic routing in dental-template. Clients can create pages and manage section order.

**Open question before starting Phase 2:** Validate that Directus row-level permissions with the `owner` workaround on `block_*` collections behave as expected. The M2A polymorphic query field selectors also need a proof-of-concept query before committing to this approach at scale.

**Reversibility:** revert dental-template changes (clean git revert). Directus schema changes are additive — no data loss.

### Phase 3 — Onboarding automation
`build-sites.js` automatically creates Directus `site_configs` record + Directus user after Groq content generation. Operator no longer needs to manually create records via Directus admin.

---

## What clients cannot edit
- Component HTML/CSS
- Font definitions
- Spacing system
- Image CDN URLs hardcoded in block defaults
- Other clients' data (enforced at API level)
