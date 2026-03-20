# CMS Directus Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a self-hosted Directus instance on Fly.io, define the `site_configs` schema, wire a GitHub Action that fetches content from Directus and deploys to Cloudflare Pages, and validate end-to-end with one demo client.

**Architecture:** Directus on Fly.io (512MB + PostgreSQL) holds client business info and theme settings. A Manual Flow in Directus exposes a Deploy button on each `site_configs` record; clicking it calls `workflow_dispatch` on the `dental-template` GitHub repo. The GitHub Action fetches from Directus, writes `site.json` + `theme.json` into the dental-template checkout, runs `astro build`, and deploys to Cloudflare Pages.

**Tech Stack:** Directus v11, Fly.io (flyctl CLI), PostgreSQL, Node.js 20 ESM, GitHub Actions, Wrangler v4, Resend (SMTP), `node:test` (unit tests)

---

## File Map

| File | Status | Purpose |
|---|---|---|
| `dental-template/.github/workflows/deploy.yml` | **Create** | GitHub Action — workflow_dispatch → fetch → build → deploy |
| `dental-template/scripts/content-transform.js` | **Create** | Pure functions: `applyBusinessFields`, `reconstructTheme` |
| `dental-template/scripts/content-transform.test.js` | **Create** | Unit tests for transform functions |
| `dental-template/scripts/fetch-content.js` | **Create** | CLI entry point — calls Directus API, calls transforms, writes files |
| `dental-template/scripts/setup-directus.js` | **Create** | One-time script — applies schema + creates Client role via Directus API |
| `dental-template/package.json` | **Modify** | Add `test` script: `node --test scripts/*.test.js` |

All Astro components and `build-sites.js` are untouched.

---

## Task 1: Fly.io — Deploy PostgreSQL

**Files:** none (infrastructure only)

- [ ] **Step 1: Install flyctl**

```bash
brew install flyctl
fly auth login
```

Expected: browser opens, sign in with Fly.io account (credit card required).

- [ ] **Step 2: Create the Fly.io app for PostgreSQL**

```bash
fly postgres create \
  --name autosite-cms-db \
  --region ams \
  --vm-size shared-cpu-1x \
  --volume-size 1 \
  --initial-cluster-size 1
```

Save the connection string printed on screen — you'll need `DATABASE_URL` in Task 2.
Expected output includes: `postgres://postgres:{password}@autosite-cms-db.flycast:5432/postgres`

- [ ] **Step 3: Verify PostgreSQL is running**

```bash
fly postgres connect -a autosite-cms-db
```

Expected: psql prompt. Type `\q` to exit.

---

## Task 2: Fly.io — Deploy Directus

**Files:** `fly.toml` (created by flyctl, not committed — add to `.gitignore`)

- [ ] **Step 1: Create the Directus app**

```bash
fly apps create autosite-cms
```

- [ ] **Step 2: Create fly.toml**

Create `fly.toml` in the repo root (not inside `dental-template/`):

```toml
app = "autosite-cms"
primary_region = "ams"

[build]
  image = "directus/directus:11"

[env]
  PORT = "8055"
  PUBLIC_URL = "https://autosite-cms.fly.dev"
  WEBSOCKETS_ENABLED = "false"

[http_service]
  internal_port = 8055
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

- [ ] **Step 3: Set required secrets**

Replace placeholders with real values:

```bash
fly secrets set \
  DB_CLIENT=pg \
  DB_CONNECTION_STRING="postgres://postgres:{password}@autosite-cms-db.flycast:5432/postgres" \
  SECRET="$(openssl rand -base64 32)" \
  ADMIN_EMAIL="your@email.com" \
  ADMIN_PASSWORD="choose-a-strong-password" \
  -a autosite-cms
```

- [ ] **Step 4: Deploy Directus**

```bash
fly deploy -a autosite-cms
```

Expected: build pulls `directus/directus:11`, deploys, prints `https://autosite-cms.fly.dev`.
Takes ~2 minutes on first deploy.

- [ ] **Step 5: Verify Directus admin is accessible**

Open `https://autosite-cms.fly.dev/admin` in browser.
Log in with the `ADMIN_EMAIL` + `ADMIN_PASSWORD` set above.
Expected: Directus admin UI loads, shows empty project.

---

## Task 3: Directus — Apply Schema via Script

**Files:** `dental-template/scripts/setup-directus.js`

This script creates the `site_configs` collection, all its fields, and the `Client` role with correct permissions via the Directus API. Run it once after Directus is deployed.

- [ ] **Step 1: Create the setup script**

Create `dental-template/scripts/setup-directus.js`:

```javascript
// One-time setup: creates site_configs schema + Client role in Directus
// Usage: DIRECTUS_URL=https://... DIRECTUS_TOKEN=... node scripts/setup-directus.js

const BASE = process.env.DIRECTUS_URL
const TOKEN = process.env.DIRECTUS_TOKEN

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`)
  return json.data
}

// 1. Create site_configs collection
await api('POST', '/collections', {
  collection: 'site_configs',
  meta: { icon: 'business', note: 'One record per client site' },
  schema: {},
})
console.log('✓ site_configs collection created')

// 2. Add fields
const fields = [
  { field: 'client_id',     type: 'string',  schema: { is_unique: true }, meta: { required: true, note: 'Cloudflare Pages project name' } },
  { field: 'business_name', type: 'string',  meta: { required: true } },
  { field: 'phone',         type: 'string',  meta: {} },
  { field: 'email',         type: 'string',  meta: {} },
  { field: 'address',       type: 'string',  meta: {} },
  { field: 'city',          type: 'string',  meta: {} },
  { field: 'postal_code',   type: 'string',  meta: {} },
  {
    field: 'theme_preset',
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      options: {
        choices: [
          { text: 'Warm Editorial', value: 'warm-editorial' },
          { text: 'Ocean Depths',   value: 'ocean-depths' },
          { text: 'Tech Innovation',value: 'tech-innovation' },
        ]
      }
    }
  },
  { field: 'theme_accent_1', type: 'string', meta: { interface: 'select-color' } },
  { field: 'theme_accent_2', type: 'string', meta: { interface: 'select-color' } },
]

for (const f of fields) {
  await api('POST', '/fields/site_configs', { ...f, schema: {} })
  console.log(`✓ field: ${f.field}`)
}

// 3. Create Client role
const role = await api('POST', '/roles', {
  name: 'Client',
  icon: 'person',
  description: 'Dental practice client — can only access their own site_config',
})
const roleId = role.id
console.log(`✓ Client role created (id: ${roleId})`)

// 5. Create owner relation: site_configs.owner → directus_users
await api('POST', '/fields/site_configs', {
  field: 'owner',
  type: 'uuid',
  schema: {},
  meta: { interface: 'select-dropdown-m2o', special: ['m2o'] },
})
await api('POST', '/relations', {
  collection: 'site_configs',
  field: 'owner',
  related_collection: 'directus_users',
})
console.log('✓ owner relation created')

// 6. Set permissions for Client role on site_configs
await api('POST', '/permissions', {
  role: roleId,
  collection: 'site_configs',
  action: 'read',
  permissions: { owner: { _eq: '$CURRENT_USER' } },
  fields: '*',
})
await api('POST', '/permissions', {
  role: roleId,
  collection: 'site_configs',
  action: 'update',
  permissions: { owner: { _eq: '$CURRENT_USER' } },
  fields: ['business_name','phone','email','address','city','postal_code','theme_preset','theme_accent_1','theme_accent_2'],
})
console.log('✓ Client role permissions set')

console.log('\n✅ Directus schema setup complete.')
console.log(`Client role ID: ${roleId}`)
console.log('Save this role ID — you need it when creating client users.')
```

- [ ] **Step 2: Get a Directus admin token**

In Directus admin UI: Settings → API Tokens → Create token → name: `setup-token`, no expiry.
Copy the token value.

- [ ] **Step 3: Run the setup script**

```bash
cd dental-template
DIRECTUS_URL=https://autosite-cms.fly.dev \
DIRECTUS_TOKEN=<your-admin-token> \
node scripts/setup-directus.js
```

Expected output:
```
✓ site_configs collection created
✓ field: client_id
✓ field: business_name
... (all fields)
✓ Client role created (id: <uuid>)
✓ owner relation created
✓ Client role permissions set

✅ Directus schema setup complete.
Client role ID: <uuid>
```

Save the Client role ID in `.env` as `DIRECTUS_CLIENT_ROLE_ID` for use during onboarding.

- [ ] **Step 4: Verify in Directus admin**

Open `https://autosite-cms.fly.dev/admin` → Settings → Data Model.
Confirm `site_configs` collection appears with all 10 fields + `owner`.

- [ ] **Step 5: Commit**

```bash
cd dental-template
git add scripts/setup-directus.js
git commit -m "feat: add Directus schema setup script"
```

---

## Task 4: SMTP — Configure Resend

**Files:** none (Fly.io secrets only)

- [ ] **Step 1: Create Resend account**

Go to resend.com → sign up → Settings → API Keys → Create API key (name: `autosite-cms`).
Copy the key (starts with `re_`).

- [ ] **Step 2: Add a sending domain or use Resend's shared domain**

For Phase 1, use Resend's shared domain (`onboarding@resend.dev`) to skip DNS setup.
Note: for production, add your own domain in Resend.

- [ ] **Step 3: Set SMTP secrets on Fly.io**

```bash
fly secrets set \
  EMAIL_TRANSPORT=smtp \
  EMAIL_FROM="AutoSite CMS <onboarding@resend.dev>" \
  EMAIL_SMTP_HOST=smtp.resend.com \
  EMAIL_SMTP_PORT=465 \
  EMAIL_SMTP_SECURE=true \
  EMAIL_SMTP_USER=resend \
  EMAIL_SMTP_PASSWORD=re_<your-resend-api-key> \
  -a autosite-cms
```

- [ ] **Step 4: Restart Directus to pick up new env vars**

```bash
fly machine restart -a autosite-cms
```

- [ ] **Step 5: Test invite email**

In Directus admin UI: Settings → Users → Invite Users.
Enter your own email address, select the Client role.
Expected: receive invite email within 1 minute.

---

## Task 5: Content Transform — TDD

**Files:**
- Create: `dental-template/scripts/content-transform.js`
- Create: `dental-template/scripts/content-transform.test.js`
- Modify: `dental-template/package.json`

- [ ] **Step 1: Add test script to package.json**

In `dental-template/package.json`, add to `"scripts"`:
```json
"test": "node --test scripts/*.test.js"
```

- [ ] **Step 2: Write failing tests**

Create `dental-template/scripts/content-transform.test.js`:

```javascript
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyBusinessFields, reconstructTheme } from './content-transform.js'

const baseSiteJson = {
  meta: { title: 'Old Title', description: 'Old desc' },
  business: {
    name: 'Old Name',
    city: 'Old City',
    address: 'Old Address',
    postal_code: '1234 AB',
    phone: '010 000 0000',
    email: 'old@example.com',
    google_reviews_score: '4.8',
    google_reviews_count: 100,
    google_reviews_url: '#',
  },
  hero: { headline: 'Old headline' },
}

const siteConfig = {
  client_id: 'tandarts-test',
  business_name: 'Tandarts Test',
  phone: '020 123 4567',
  email: 'info@tandarts-test.nl',
  address: 'Teststraat 1',
  city: 'Amsterdam',
  postal_code: '1000 AA',
  theme_preset: 'warm-editorial',
  theme_accent_1: '#FF0000',
  theme_accent_2: '#CC0000',
}

const warmEditorialPreset = {
  preset: 'warm-editorial',
  fonts: {
    display_family: 'Cormorant Garamond',
    display_url: 'Cormorant+Garamond:ital,wght@0,400',
    body_family: 'DM Sans',
    body_url: 'DM+Sans:ital,opsz,wght@0,9..40,300',
    display_fallback: 'Georgia, serif',
    body_fallback: 'system-ui, sans-serif',
  },
  colors: {
    accent: '#2D7A6C',
    accent_hover: '#226359',
    accent_light: '#EBF5F2',
    bg: '#FAF7F2',
    bg_alt: '#F0E9DE',
    bg_dark: '#1C1917',
    text: '#1C1917',
    text_muted: '#78716C',
    text_light: '#FAF7F2',
    border: '#E5DDD3',
    star: '#F5A623',
  },
  radius: { sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2.5rem' },
}

describe('applyBusinessFields', () => {
  it('overrides business fields from siteConfig', () => {
    const result = applyBusinessFields(baseSiteJson, siteConfig)
    assert.equal(result.business.name, 'Tandarts Test')
    assert.equal(result.business.phone, '020 123 4567')
    assert.equal(result.business.email, 'info@tandarts-test.nl')
    assert.equal(result.business.address, 'Teststraat 1')
    assert.equal(result.business.city, 'Amsterdam')
    assert.equal(result.business.postal_code, '1000 AA')
  })

  it('preserves non-business fields unchanged', () => {
    const result = applyBusinessFields(baseSiteJson, siteConfig)
    assert.deepEqual(result.hero, baseSiteJson.hero)
    assert.deepEqual(result.meta, baseSiteJson.meta)
  })

  it('preserves existing google_reviews fields', () => {
    const result = applyBusinessFields(baseSiteJson, siteConfig)
    assert.equal(result.business.google_reviews_score, '4.8')
    assert.equal(result.business.google_reviews_count, 100)
  })
})

describe('reconstructTheme', () => {
  it('overrides accent colors from siteConfig', () => {
    const result = reconstructTheme(siteConfig, { 'warm-editorial': warmEditorialPreset })
    assert.equal(result.colors.accent, '#FF0000')
    assert.equal(result.colors.accent_hover, '#CC0000')
  })

  it('preserves non-accent colors from preset', () => {
    const result = reconstructTheme(siteConfig, { 'warm-editorial': warmEditorialPreset })
    assert.equal(result.colors.bg, '#FAF7F2')
    assert.equal(result.colors.text, '#1C1917')
  })

  it('preserves fonts and radius from preset', () => {
    const result = reconstructTheme(siteConfig, { 'warm-editorial': warmEditorialPreset })
    assert.deepEqual(result.fonts, warmEditorialPreset.fonts)
    assert.deepEqual(result.radius, warmEditorialPreset.radius)
  })

  it('calculates accent_light by lightening accent color', () => {
    const result = reconstructTheme(siteConfig, { 'warm-editorial': warmEditorialPreset })
    // #FF0000 lightened 85% toward white: r=255, g=round(0+255*0.85)=217, b=round(0+255*0.85)=217
    assert.equal(result.colors.accent_light, '#ffd9d9')
  })

  it('uses the correct preset from siteConfig.theme_preset', () => {
    const result = reconstructTheme(siteConfig, { 'warm-editorial': warmEditorialPreset })
    assert.equal(result.preset, 'warm-editorial')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd dental-template
npm test
```

Expected: `Error: Cannot find module './content-transform.js'`

- [ ] **Step 4: Implement content-transform.js**

Create `dental-template/scripts/content-transform.js`:

```javascript
/**
 * Pure transform functions — no I/O, no side effects, fully testable.
 */

/**
 * Merges Directus site_config business fields into the base site.json.
 * All other sections (hero, services, team, etc.) are preserved unchanged.
 */
export function applyBusinessFields(siteJson, config) {
  return {
    ...siteJson,
    business: {
      ...siteJson.business,
      name:        config.business_name,
      phone:       config.phone,
      email:       config.email,
      address:     config.address,
      city:        config.city,
      postal_code: config.postal_code,
    },
  }
}

/**
 * Reconstructs theme.json from a site_config + a map of preset JSON objects.
 * @param {object} config - Directus site_config record
 * @param {object} presets - Map of preset name → preset JSON (e.g. { 'warm-editorial': {...} })
 */
export function reconstructTheme(config, presets) {
  const preset = presets[config.theme_preset]
  if (!preset) throw new Error(`Unknown theme preset: ${config.theme_preset}`)

  return {
    ...preset,
    colors: {
      ...preset.colors,
      accent:       config.theme_accent_1,
      accent_hover: config.theme_accent_2,
      accent_light: lightenHex(config.theme_accent_1, 0.85),
    },
  }
}

/**
 * Lightens a hex color by mixing it toward white.
 * amount=0.85 means 85% toward white.
 */
export function lightenHex(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lr = Math.round(r + (255 - r) * amount)
  const lg = Math.round(g + (255 - g) * amount)
  const lb = Math.round(b + (255 - b) * amount)
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd dental-template
npm test
```

Expected: all tests pass, output shows `✓` for each test case.

- [ ] **Step 6: Commit**

```bash
git add scripts/content-transform.js scripts/content-transform.test.js package.json
git commit -m "feat: add content transform functions with tests"
```

---

## Task 6: fetch-content.js — CLI Entry Point

**Files:**
- Create: `dental-template/scripts/fetch-content.js`

- [ ] **Step 1: Create fetch-content.js**

```javascript
/**
 * Fetches site content from Directus and writes site.json + theme.json
 * for use by the Astro build.
 *
 * Usage: node scripts/fetch-content.js <client_id>
 * Env:   DIRECTUS_URL, DIRECTUS_TOKEN
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyBusinessFields, reconstructTheme } from './content-transform.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const clientId = process.argv[2]
if (!clientId) {
  console.error('Usage: node fetch-content.js <client_id>')
  process.exit(1)
}

const DIRECTUS_URL   = process.env.DIRECTUS_URL
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.error('Missing DIRECTUS_URL or DIRECTUS_TOKEN env vars')
  process.exit(1)
}

// Fetch site_config from Directus
const res = await fetch(
  `${DIRECTUS_URL}/items/site_configs?filter[client_id][_eq]=${encodeURIComponent(clientId)}&fields=*`,
  { headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` } }
)

if (!res.ok) {
  console.error(`Directus API error: ${res.status} ${await res.text()}`)
  process.exit(1)
}

const { data } = await res.json()
const config = data?.[0]

if (!config) {
  console.error(`No site_config found for client_id: ${clientId}`)
  process.exit(1)
}

// Load base site.json (dental-template default)
const dataDir     = resolve(__dirname, '../src/data')
const siteJson    = JSON.parse(readFileSync(resolve(dataDir, 'site.json'), 'utf8'))

// Load all theme presets
const themesDir   = resolve(dataDir, 'themes')
const presetNames = ['warm-editorial', 'ocean-depths', 'tech-innovation']
const presets     = Object.fromEntries(
  presetNames.map(name => [name, JSON.parse(readFileSync(resolve(themesDir, `${name}.json`), 'utf8'))])
)

// Transform
const mergedSite  = applyBusinessFields(siteJson, config)
const mergedTheme = reconstructTheme(config, presets)

// Write output files
writeFileSync(resolve(dataDir, 'site.json'),  JSON.stringify(mergedSite,  null, 2))
writeFileSync(resolve(dataDir, 'theme.json'), JSON.stringify(mergedTheme, null, 2))

console.log(`✓ Content written for client: ${clientId}`)
console.log(`  business_name: ${config.business_name}`)
console.log(`  theme_preset:  ${config.theme_preset}`)
```

- [ ] **Step 2: Test locally with real Directus**

First, create a test record directly in Directus admin UI:
- Go to `site_configs` → Create item
- Set `client_id: test-local`, `business_name: Test Lokaal`, `theme_preset: warm-editorial`, `theme_accent_1: #2D7A6C`, `theme_accent_2: #226359`

Then run:
```bash
cd dental-template
DIRECTUS_URL=https://autosite-cms.fly.dev \
DIRECTUS_TOKEN=<admin-token> \
node scripts/fetch-content.js test-local
```

Expected output:
```
✓ Content written for client: test-local
  business_name: Test Lokaal
  theme_preset:  warm-editorial
```

Verify `dental-template/src/data/site.json` now has `business.name: "Test Lokaal"`.

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-content.js
git commit -m "feat: add fetch-content CLI script"
```

---

## Task 7: GitHub Action — deploy.yml

**Files:**
- Create: `dental-template/.github/workflows/deploy.yml`

- [ ] **Step 1: Add required secrets to the dental-template GitHub repo**

In GitHub: dental-template repo → Settings → Secrets and variables → Actions → New repository secret.

Add all four:
| Secret name | Value |
|---|---|
| `DIRECTUS_URL` | `https://autosite-cms.fly.dev` |
| `DIRECTUS_TOKEN` | The admin token from Task 3 Step 2 (or create a separate read-only token) |
| `CLOUDFLARE_API_TOKEN` | Already exists in your local `.env` |
| `CLOUDFLARE_ACCOUNT_ID` | Already exists in your local `.env` |

**Note:** Create a separate read-only Directus token for the Action (Settings → API Tokens → Create, name: `github-actions-readonly`). Do not reuse the admin token.

- [ ] **Step 2: Create the workflow file**

Create `dental-template/.github/workflows/deploy.yml`:

```yaml
name: Deploy Client Site

on:
  workflow_dispatch:
    inputs:
      client_id:
        description: 'Client ID (Cloudflare Pages project name, e.g. tandarts-amsterdam)'
        required: true
        type: string

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout dental-template
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Fetch content from Directus
        run: node scripts/fetch-content.js "${{ inputs.client_id }}"
        env:
          DIRECTUS_URL: ${{ secrets.DIRECTUS_URL }}
          DIRECTUS_TOKEN: ${{ secrets.DIRECTUS_TOKEN }}

      - name: Build Astro site
        run: npm run build

      - name: Create Cloudflare Pages project (idempotent)
        run: npx wrangler pages project create "${{ inputs.client_id }}" --production-branch main || true
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

      - name: Deploy to Cloudflare Pages
        run: npx wrangler pages deploy dist/ --project-name "${{ inputs.client_id }}" --branch main
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 3: Push to GitHub**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Action for Directus-driven deploy"
git push origin master
```

- [ ] **Step 4: Manually trigger the Action to verify it works**

In GitHub: dental-template repo → Actions → "Deploy Client Site" → Run workflow.
Input `client_id: test-local` (the record you created in Task 6 Step 2).

Expected: Action runs, all steps green, site deployed to `https://test-local.pages.dev`.
Open the URL and verify `business.name` shows "Test Lokaal".

---

## Task 8: Directus Deploy Flow

**Files:** none (Directus UI configuration only)

This creates the Deploy button on the `site_configs` item page.

- [ ] **Step 1: Create a GitHub fine-grained PAT for Directus**

In GitHub: Settings → Developer settings → Fine-grained tokens → Generate new token.
- Name: `directus-deploy-trigger`
- Repository access: Only `dental-template`
- Permissions: Actions → Read and Write

Copy the token (starts with `github_pat_`).

- [ ] **Step 2: Store the PAT as a Directus env var on Fly.io**

```bash
fly secrets set DIRECTUS_GITHUB_PAT=github_pat_<your-token> -a autosite-cms
fly machine restart -a autosite-cms
```

- [ ] **Step 3: Create the Flow in Directus**

In Directus admin UI:
1. Go to Settings → Flows → Create Flow
2. Name: `Deploy Site`, Icon: `rocket_launch`, Status: Active
3. Trigger: **Manual** → Scope: `item` → Collection: `site_configs` → Location: `Item Detail`
4. Click Save Trigger

- [ ] **Step 4: Add a Read Data operation (first node after trigger)**

In the Flow canvas, click `+` after the trigger to add the first operation:
1. Type: **Read Data**
2. Name: `Read site_config`
3. Collection: `site_configs`
4. IDs: `{{ $trigger.body.keys }}`
5. Fields: `client_id`
6. Save the operation.

This resolves the UUID primary key from the trigger into the `client_id` string needed by the GitHub API.

- [ ] **Step 5: Add the HTTP Request operation (second node)**

Click `+` after the Read Data node to add:
1. Type: **Trigger Webhook / Request URL**
2. Name: `Trigger GitHub Deploy`
3. Method: `POST`
4. URL: `https://api.github.com/repos/YOUR_GITHUB_USERNAME/dental-template/actions/workflows/deploy.yml/dispatches`
5. Headers:
   ```
   Authorization: Bearer {{$env.DIRECTUS_GITHUB_PAT}}
   Accept: application/vnd.github+json
   X-GitHub-Api-Version: 2022-11-28
   ```
6. Request Body (JSON):
   ```json
   {
     "ref": "master",
     "inputs": {
       "client_id": "{{ $last.client_id }}"
     }
   }
   ```
   (`$last` refers to the output of the Read Data node above.)
7. Save the flow.

- [ ] **Step 7: Verify the Deploy button appears**

Go to `site_configs` → open any item.
Expected: a **"Deploy Site"** button appears in the top-right action bar.

- [ ] **Step 8: Test the full trigger chain**

Click "Deploy Site" on the `test-local` record.
Expected:
- Flow runs (green checkmark in Flows log)
- GitHub Action fires (visible in dental-template Actions tab)
- Action completes successfully

---

## Task 9: End-to-End Demo Client

**Files:** none

This task validates the complete client journey: invite → login → edit → deploy.

- [ ] **Step 1: Create a demo site_configs record**

In Directus admin UI → site_configs → Create item:
- `client_id`: `demo-tandarts`
- `business_name`: `Tandartspraktijk Demo`
- `phone`: `020 000 0000`
- `email`: `info@demo-tandarts.nl`
- `address`: `Demostraat 1`
- `city`: `Amsterdam`
- `postal_code`: `1000 AB`
- `theme_preset`: `warm-editorial`
- `theme_accent_1`: `#2D7A6C`
- `theme_accent_2`: `#226359`

Leave `owner` empty for now.

- [ ] **Step 2: Invite a demo client user**

In Directus admin UI → Settings → Users → Invite Users:
- Email: use your own email (or a test email you control)
- Role: Client

Expected: invite email arrives. Click the link, set a password.

- [ ] **Step 3: Link the user to their site_config**

In Directus admin UI → site_configs → `demo-tandarts` → set `owner` field to the user you just created.

- [ ] **Step 4: Log in as the client**

Open a private/incognito browser window.
Go to `https://autosite-cms.fly.dev/admin`.
Log in with the demo client credentials.

Expected:
- Only `demo-tandarts` record is visible in `site_configs`
- No other records are accessible
- Cannot access Settings, other collections, or admin areas beyond site_configs

- [ ] **Step 5: Edit a field and deploy**

As the demo client:
1. Change `business_name` to `Tandartspraktijk Demo Gewijzigd`
2. Click Save
3. Click Deploy Site

Expected: GitHub Action runs, site rebuilds, `https://demo-tandarts.pages.dev` shows the new business name.

- [ ] **Step 6: Commit final state**

```bash
git add .
git commit -m "feat: CMS Directus Phase 1 complete — end-to-end validated"
git push origin master
```

---

## Known Limitations (carry forward to Phase 2 planning)

- Only business info + theme are editable. Hero, services, team, etc. stay as Groq-generated defaults.
- `page_section_blocks` and M2A permission scoping via `owner` field workaround must be proven before Phase 2 is planned.
- No onboarding automation — operator manually creates `site_configs` records and invites users.
- No debounce on Deploy button — double-clicking triggers two Action runs (harmless but wastes CI minutes).
