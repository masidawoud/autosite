# Payload CMS Spike — Cloudflare Workers + D1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate whether Payload CMS v3 on Cloudflare Workers + D1 can replace Sveltia + Gitea as the CMS for AutoSite, answering feasibility before committing to a full migration.

**Architecture:** One Payload CMS instance running as a Cloudflare Worker, using D1 as the SQLite database. Clients log in with email+password, edit dental content in a multi-tenant admin UI. On content save, a GitHub Actions workflow fetches content from the Payload REST API, builds the Astro dental-template, and deploys to Cloudflare Pages. Template propagation (operator pushes a design update to all clients) is a single CLI command that triggers one GitHub Actions run per tenant in parallel.

**Tech Stack:** Payload CMS v3.79+, `@payloadcms/db-d1-sqlite`, `@payloadcms/plugin-multi-tenant`, Cloudflare Workers, Cloudflare D1, wrangler CLI v4, GitHub Actions, Astro 4 (existing dental-template), Node.js ESM scripts

---

## Why the previous attempt failed

The previous spike used `@payloadcms/db-sqlite` (the **local SQLite adapter**) instead of `@payloadcms/db-d1-sqlite` (the **Cloudflare D1 adapter**). These are different packages. The local SQLite adapter uses a file path / connection string — Cloudflare D1 uses a Worker binding (`cloudflare.env.D1`), not a connection string. Additionally, the multi-tenant plugin was configured with non-existent options (`userHasTenantField`, `userHasAccessToAllTenants`). This plan corrects both mistakes.

---

## Spike success criteria (all must pass)

- [ ] Payload admin loads at a Cloudflare Workers URL with email+password login
- [ ] Two test client tenants exist; each sees only their own DentalSite record
- [ ] Operator (`super-admin`) sees all tenants
- [ ] Provisioning script creates a new tenant + user + site record via REST API
- [ ] A GitHub Actions workflow (triggered manually) fetches content from Payload, builds Astro, deploys to CF Pages
- [ ] `node scripts/trigger-payload-rebuilds.js` triggers all tenant builds in parallel
- [ ] Monthly cost estimate is under €30 for CMS infrastructure

---

## Scope — what this does NOT build

- Full dental content schema (all 15+ current YAML fields) — the minimal schema below is sufficient to prove the data flow
- Image uploads / R2 media storage — omit for the spike; no images in the DentalSites schema
- Live preview or custom admin UI styling
- Custom domain for the Payload admin (`cms.foove.nl`) — use the workers.dev URL
- Error handling or retry logic in scripts
- More than 3 test tenants

---

## File structure

```
autosite/
  payload-cms/                          ← new Payload project (Cloudflare Workers target)
    src/
      app/                              ← Next.js app (from template — do not modify)
      collections/
        Tenants.ts                      ← Tenants collection (slug, cfPagesProject)
        Users.ts                        ← Users collection (auth: true, role field)
        DentalSites.ts                  ← Dental content (hero, contact, services)
      payload.config.ts                 ← root Payload config with D1 adapter + multi-tenant plugin
    wrangler.jsonc                      ← Cloudflare Workers config (from template, update D1 id)
    open-next.config.ts                 ← OpenNext config (from template — do not modify)
    package.json
    tsconfig.json
  scripts/
    provision-payload.js                ← creates tenant + user + site via Payload REST API
    trigger-payload-rebuilds.js         ← loops all tenants, dispatches GitHub Actions per tenant
  .github/workflows/
    build-from-payload.yml              ← fetches content from Payload API, builds Astro, deploys to CF Pages
```

---

## Task 1: Scaffold the correct Payload template

**Files:**
- Create: `payload-cms/` (from `with-cloudflare-d1` template)

- [ ] **Step 1: Scaffold from the Cloudflare D1 template**

Run from `autosite/` root:

```bash
npx create-payload-app@latest payload-cms \
  --template with-cloudflare-d1 \
  --no-git
```

If prompted for a project name, use `autosite-payload-cms`.

Expected: `payload-cms/` directory created with `src/`, `wrangler.jsonc`, `open-next.config.ts`, `package.json` using `pnpm`.

- [ ] **Step 2: Install dependencies**

```bash
cd payload-cms && pnpm install
```

Expected: dependencies installed, no errors.

- [ ] **Step 3: Verify the scaffold has the correct D1 adapter**

```bash
grep -r "db-d1-sqlite\|sqliteD1Adapter" src/payload.config.ts
```

Expected: both strings appear. If `db-sqlite` or `sqliteAdapter` appear instead, the wrong template was used — delete `payload-cms/` and re-scaffold.

- [ ] **Step 4: Verify the wrangler.jsonc has a D1 binding**

Open `payload-cms/wrangler.jsonc` and confirm it contains a `d1_databases` block:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "autosite-cms",
      "database_id": "REPLACE_AFTER_CREATION"
    }
  ]
}
```

The `binding` value must match what `sqliteD1Adapter` uses in `payload.config.ts`. Write it down.

- [ ] **Step 5: Commit the scaffold**

```bash
cd ..
git add payload-cms/
git commit -m "spike: scaffold Payload CMS from with-cloudflare-d1 template"
```

---

## Task 2: Create Cloudflare D1 database

**Files:**
- Modify: `payload-cms/wrangler.jsonc` (insert real `database_id`)

- [ ] **Step 1: Create the D1 database**

```bash
cd payload-cms
npx wrangler d1 create autosite-cms
```

Expected output includes:

```
✅ Successfully created DB 'autosite-cms' in region WEUR
Created your new D1 database.

[[d1_databases]]
binding = "DB"
database_name = "autosite-cms"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` value.

- [ ] **Step 2: Update wrangler.jsonc with the real database_id**

Open `payload-cms/wrangler.jsonc`. Find the `d1_databases` entry and replace `"REPLACE_AFTER_CREATION"` with the ID you just copied.

The entry should look like:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "autosite-cms",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
cd ..
git add payload-cms/wrangler.jsonc
git commit -m "spike: configure wrangler.jsonc with real D1 database_id"
```

---

## Task 3: Define AutoSite content model

**Files:**
- Create: `payload-cms/src/collections/Tenants.ts`
- Create: `payload-cms/src/collections/Users.ts`
- Create: `payload-cms/src/collections/DentalSites.ts`
- Modify: `payload-cms/src/payload.config.ts`

The multi-tenant plugin adds a `tenants` relationship field to Users automatically. Users have a `role` field: `super-admin` (operator, sees all tenants) or `user` (client, sees only their tenant).

- [ ] **Step 1: Create Tenants collection**

Create `payload-cms/src/collections/Tenants.ts`:

```typescript
import type { CollectionConfig } from 'payload'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Used as the Cloudflare Pages project name suffix (e.g. lie-dental → dentist-lie-dental)',
      },
    },
    {
      name: 'cfPagesProject',
      label: 'Cloudflare Pages Project Name',
      type: 'text',
      required: true,
      admin: {
        description: 'Exact CF Pages project name (e.g. dentist-lie-dental)',
      },
    },
  ],
}
```

- [ ] **Step 2: Create Users collection**

Create `payload-cms/src/collections/Users.ts`:

```typescript
import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      options: [
        { label: 'Super Admin (Operator)', value: 'super-admin' },
        { label: 'Client', value: 'user' },
      ],
      access: {
        // Only super-admins can change roles
        update: ({ req: { user } }) =>
          (user as any)?.role === 'super-admin',
      },
    },
  ],
}
```

- [ ] **Step 3: Create DentalSites collection**

Create `payload-cms/src/collections/DentalSites.ts`:

```typescript
import type { CollectionConfig } from 'payload'

export const DentalSites: CollectionConfig = {
  slug: 'dental-sites',
  admin: {
    useAsTitle: 'practiceName',
  },
  fields: [
    {
      name: 'practiceName',
      label: 'Practice Name',
      type: 'text',
      required: true,
    },
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'headlineLight', label: 'Headline (light text)', type: 'text' },
        { name: 'headlineHeavy', label: 'Headline (bold text)', type: 'text' },
        { name: 'subtext', label: 'Subtext / description', type: 'textarea' },
        { name: 'cta', label: 'CTA Button Text', type: 'text', defaultValue: 'Maak een afspraak' },
      ],
    },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'hours', label: 'Opening hours (short)', type: 'text' },
      ],
    },
    {
      name: 'services',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
      ],
    },
  ],
}
```

- [ ] **Step 4: Update payload.config.ts**

Replace the contents of `payload-cms/src/payload.config.ts` with the following. **Check that the `binding` name matches what is in `wrangler.jsonc`** (typically `"DB"` — if the template used a different name, use that):

```typescript
import { buildConfig } from 'payload'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { DentalSites } from './collections/DentalSites'
import type { Config } from './payload-types'

// cloudflare is available in the Worker environment — this import is added by the template
declare const cloudflare: { env: { DB: D1Database } }

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || 'spike-change-in-prod',
  admin: {
    user: 'users',
  },
  collections: [Tenants, Users, DentalSites],
  db: sqliteD1Adapter({
    binding: cloudflare.env.DB,
  }),
  plugins: [
    multiTenantPlugin<Config>({
      tenantsArrayField: {
        arrayFieldName: 'tenants',
        includeDefaultField: true,
      },
      collections: {
        'dental-sites': {},
      },
      userHasAccessToAllTenants: (user) => (user as any)?.role === 'super-admin',
    }),
  ],
})
```

**Note:** The `multiTenantPlugin` adds a `tenants` relationship array field to the Users collection automatically. It also adds a `tenant` relationship field to each collection in `collections`. You do not add these fields manually.

- [ ] **Step 5: Build and verify no TypeScript errors**

```bash
cd payload-cms && pnpm build
```

Expected: build completes. If TypeScript errors appear in the `payload-types` import (because types haven't been generated yet), run:

```bash
pnpm payload generate:types
pnpm build
```

Fix any errors before continuing. The most common issue is the `cloudflare.env.DB` type — if the template has a different way to access bindings, use the pattern from the template's existing `payload.config.ts`.

- [ ] **Step 6: Commit**

```bash
cd ..
git add payload-cms/src/
git commit -m "spike: add Tenants, Users, DentalSites collections with correct D1 adapter and multi-tenant plugin"
```

---

## Task 4: Run locally and verify tenant isolation

**Files:**
- No new files — operational validation only

Local dev for Cloudflare Workers uses `wrangler dev`, not the Next.js dev server. Wrangler provides a local D1 simulation automatically.

- [ ] **Step 1: Start local dev server**

```bash
cd payload-cms && pnpm dev
```

Or, if the template uses wrangler directly:

```bash
cd payload-cms && npx wrangler dev
```

Check `package.json` for the `dev` script and use whatever it specifies.

Expected: server starts. Navigate to `http://localhost:3000/admin` (or the port wrangler reports).

- [ ] **Step 2: Create the first admin user**

On first boot you will be prompted to create an admin user. Use:
- Email: `admin@foove.nl`
- Password: (use a real password, note it down)

After creating, set the role to `super-admin` — you may need to go to Users → admin@foove.nl → set role field.

- [ ] **Step 3: Create two test tenants**

Navigate to Tenants → Create New:

**Tenant A:**
- Name: `Lie Dental`
- Slug: `lie-dental`
- Cloudflare Pages Project Name: `dentist-lie-dental`

**Tenant B:**
- Name: `Test Praktijk`
- Slug: `test-praktijk`
- Cloudflare Pages Project Name: `dentist-test-praktijk`

- [ ] **Step 4: Create one client user per tenant**

Navigate to Users → Create New:

**User A:**
- Email: `balie@liedental.nl`
- Password: `test-client-a-pass`
- Role: `user`
- (The multi-tenant plugin's tenant selector widget should appear — assign Tenant A)

**User B:**
- Email: `info@testpraktijk.nl`
- Password: `test-client-b-pass`
- Role: `user`
- (Assign Tenant B)

- [ ] **Step 5: Create a DentalSite record for Tenant A**

Log in as `admin@foove.nl`. Navigate to Dental Sites → Create New. Assign Tenant A. Fill in:
- Practice Name: `Tandartspraktijk Lie Dental`
- Hero headline light: `Familiepraktijk`
- Hero headline heavy: `sinds 1980 in Rotterdam.`
- Contact phone: `010-210 20 00`
- Services: one item — name: `Controle`, description: `Periodieke tandheelkundige controle`

Create one for Tenant B as well (any content).

- [ ] **Step 6: Verify tenant isolation**

Open a private/incognito browser window. Navigate to `http://localhost:3000/admin`. Log in as `balie@liedental.nl`.

Expected: Dental Sites list shows only the Lie Dental record. No Test Praktijk record visible.

Log out. Log in as `info@testpraktijk.nl`. Same check — only Test Praktijk record visible.

If either user can see the other's data, the multi-tenant plugin is misconfigured. Do not proceed until isolation is confirmed. Check that:
1. The `userHasAccessToAllTenants` option correctly identifies super-admins
2. The `tenants` field on each user is set correctly
3. The `collections` option in `multiTenantPlugin` includes `'dental-sites'`

- [ ] **Step 7: Verify REST API returns tenant data**

```bash
# Login as admin and get token
TOKEN=$(curl -s -X POST http://localhost:3000/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@foove.nl","password":"<your-admin-password>"}' \
  | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).token))")

# Fetch all dental sites
curl -s "http://localhost:3000/api/dental-sites?depth=1" \
  -H "Authorization: Bearer $TOKEN" | node -e "
  process.stdin.resume(); let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    const r=JSON.parse(d);
    console.log('Total docs:', r.totalDocs);
    r.docs.forEach(s=>console.log('-', s.practiceName, '| tenant:', s.tenant?.name));
  })"
```

Expected:
```
Total docs: 2
- Tandartspraktijk Lie Dental | tenant: Lie Dental
- <Test Praktijk practice name> | tenant: Test Praktijk
```

---

## Task 5: Deploy to Cloudflare Workers

**Files:**
- No new files — deployment only

- [ ] **Step 1: Set the PAYLOAD_SECRET for the Worker**

```bash
cd payload-cms
npx wrangler secret put PAYLOAD_SECRET
```

Enter a strong random string (32+ characters). This is the JWT signing secret for Payload.

- [ ] **Step 2: Run migrations against the remote D1 database**

The template's `deploy` script handles this, but verify the migration command:

```bash
pnpm payload migrate
```

Or check `package.json` for the exact migrate command. If the template uses `wrangler d1 execute`:

```bash
npx wrangler d1 migrations apply autosite-cms --remote
```

- [ ] **Step 3: Deploy the Worker**

```bash
pnpm run deploy
```

This command (from the template) builds the application and deploys to Cloudflare Workers.

Expected output includes a Workers URL:
```
✅ Deployed to https://autosite-payload-cms.<your-subdomain>.workers.dev
```

Write down this URL — you will use it for the GitHub Actions secrets and the provisioning script.

- [ ] **Step 4: Create the first admin user on the deployed instance**

Navigate to `https://autosite-payload-cms.<your-subdomain>.workers.dev/admin`.

Create the admin user:
- Email: `admin@foove.nl`
- Password: (use the same password as local, note it down)

Then: Users → admin@foove.nl → set role to `super-admin`.

- [ ] **Step 5: Verify the deployed admin loads and login works**

Log in at the Workers URL. Confirm the admin panel loads and you can navigate to Collections.

- [ ] **Step 6: Generate a Payload API key for the operator account**

In the admin panel: navigate to Users → admin@foove.nl. If the template has an "API Keys" section, generate one. If not, you will use the JWT token from `/api/users/login` in the scripts.

Note: Payload v3's REST API supports Bearer tokens from the login endpoint. This is sufficient for the spike — no need for the API Keys plugin unless specifically needed.

- [ ] **Step 7: Commit**

```bash
cd ..
# Only commit wrangler.jsonc if it changed (it shouldn't at this point)
git status
git commit --allow-empty -m "spike: deployed to Cloudflare Workers (operational)"
```

---

## Task 6: GitHub Actions build workflow

**Files:**
- Create: `.github/workflows/build-from-payload.yml`

This workflow is triggered manually (`workflow_dispatch`) with a `client_id` (tenant slug) and `cf_project_name` (CF Pages project). It fetches content from the deployed Payload instance, writes `site.json`, builds the Astro dental-template, and deploys to Cloudflare Pages.

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/build-from-payload.yml`:

```yaml
name: Build and deploy from Payload CMS

on:
  workflow_dispatch:
    inputs:
      client_id:
        description: 'Tenant slug (e.g. lie-dental)'
        required: true
        type: string
      cf_project_name:
        description: 'Cloudflare Pages project name (e.g. dentist-lie-dental)'
        required: true
        type: string

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout autosite repo
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: dental-template/package-lock.json

      - name: Fetch content from Payload and write site.json
        env:
          PAYLOAD_API_URL: ${{ secrets.PAYLOAD_API_URL }}
          PAYLOAD_API_EMAIL: ${{ secrets.PAYLOAD_API_EMAIL }}
          PAYLOAD_API_PASSWORD: ${{ secrets.PAYLOAD_API_PASSWORD }}
        run: |
          node -e "
          const { execSync } = require('child_process');

          async function main() {
            // 1. Login to get a token
            const loginRes = await fetch(process.env.PAYLOAD_API_URL + '/api/users/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: process.env.PAYLOAD_API_EMAIL,
                password: process.env.PAYLOAD_API_PASSWORD,
              }),
            });
            const loginData = await loginRes.json();
            if (!loginRes.ok) {
              console.error('Login failed:', loginData);
              process.exit(1);
            }
            const token = loginData.token;

            // 2. Fetch the dental site for this tenant
            const clientId = '${{ inputs.client_id }}';
            const url = process.env.PAYLOAD_API_URL + '/api/dental-sites?where[tenant.slug][equals]=' + clientId + '&depth=1&limit=1';
            const siteRes = await fetch(url, {
              headers: { Authorization: 'Bearer ' + token },
            });
            const siteData = await siteRes.json();

            if (!siteData.docs || siteData.docs.length === 0) {
              console.error('No dental site found for tenant:', clientId);
              process.exit(1);
            }

            const site = siteData.docs[0];
            console.log('Fetched site:', site.practiceName);

            // 3. Map Payload fields to site.json format
            const siteJson = {
              business: {
                name: site.practiceName || '',
                phone: site.contact?.phone || '',
                email: site.contact?.email || '',
              },
              hero: {
                eyebrow: '',
                headline_light: site.hero?.headlineLight || '',
                headline_heavy: site.hero?.headlineHeavy || '',
                description: site.hero?.subtext || '',
                cta_primary: site.hero?.cta || 'Maak een afspraak',
                cta_secondary: 'Onze diensten',
                image_url: 'https://picsum.photos/seed/dental-hero/720/860',
              },
              services: {
                eyebrow: 'Diensten',
                title: 'Alles voor een gezond gebit',
                subtitle: '',
                items: (site.services || []).map(s => ({
                  tag: '',
                  title: s.name,
                  desc: s.description || '',
                  image_url: '',
                })),
              },
            };

            // 4. Write to dental-template
            require('fs').writeFileSync(
              'dental-template/src/data/site.json',
              JSON.stringify(siteJson, null, 2)
            );
            console.log('site.json written successfully');
          }

          main().catch(err => { console.error(err); process.exit(1); });
          "

      - name: Build Astro site
        working-directory: dental-template
        run: npm ci && npm run build

      - name: Deploy to Cloudflare Pages
        working-directory: dental-template
        run: npx wrangler@4 pages deploy dist --project-name=${{ inputs.cf_project_name }}
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Add required GitHub Actions secrets**

In the GitHub repo settings → Secrets and variables → Actions → New repository secret, add:

| Secret name | Value |
|---|---|
| `PAYLOAD_API_URL` | `https://autosite-payload-cms.<your-subdomain>.workers.dev` |
| `PAYLOAD_API_EMAIL` | `admin@foove.nl` |
| `PAYLOAD_API_PASSWORD` | (your admin password) |
| `CLOUDFLARE_API_TOKEN` | (existing — already set if previous workflows exist) |
| `CLOUDFLARE_ACCOUNT_ID` | (existing) |

- [ ] **Step 3: Create test tenant content on the deployed Payload instance**

In the deployed admin at `https://autosite-payload-cms.<subdomain>.workers.dev/admin`:

1. Create Tenant A: `Lie Dental` / slug `lie-dental` / CF project `dentist-lie-dental`
2. Create User A: `balie@liedental.nl`, role `user`, assign to Lie Dental
3. Create DentalSite for Lie Dental (same data as Task 4 Step 5)

- [ ] **Step 4: Run the workflow manually**

In the GitHub repo → Actions → "Build and deploy from Payload CMS" → Run workflow:
- `client_id`: `lie-dental`
- `cf_project_name`: `dentist-lie-dental`

Watch the run. All steps should pass. The deployed Cloudflare Pages site should update.

If the `fetch content` step fails with "No dental site found", check that:
- The `PAYLOAD_API_URL` secret points to the deployed Workers URL (no trailing slash)
- Lie Dental's `slug` field is exactly `lie-dental`
- The DentalSite record has `tenant` set to Lie Dental

- [ ] **Step 5: Commit the workflow**

```bash
git add .github/workflows/build-from-payload.yml
git commit -m "spike: add GitHub Actions workflow to build Astro from Payload API"
```

---

## Task 7: Provisioning script

**Files:**
- Create: `scripts/provision-payload.js`

- [ ] **Step 1: Create `scripts/` directory and provisioning script**

Create `scripts/provision-payload.js`:

```javascript
#!/usr/bin/env node
// Provisions a new AutoSite client: creates tenant + client user + empty DentalSite record.
//
// Usage:
//   PAYLOAD_API_URL=https://... PAYLOAD_API_EMAIL=admin@foove.nl PAYLOAD_API_PASSWORD=... \
//   node scripts/provision-payload.js \
//     --name "Tandartspraktijk X" \
//     --slug tandartspraktijk-x \
//     --cf-project dentist-tandartspraktijk-x \
//     --email balie@tandartspraktijkx.nl \
//     --password <initial-client-password>

import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    name:           { type: 'string' },
    slug:           { type: 'string' },
    'cf-project':   { type: 'string' },
    email:          { type: 'string' },
    password:       { type: 'string' },
  },
})

const { PAYLOAD_API_URL, PAYLOAD_API_EMAIL, PAYLOAD_API_PASSWORD } = process.env

if (!PAYLOAD_API_URL || !PAYLOAD_API_EMAIL || !PAYLOAD_API_PASSWORD) {
  console.error('Error: PAYLOAD_API_URL, PAYLOAD_API_EMAIL, PAYLOAD_API_PASSWORD must be set')
  process.exit(1)
}

if (!values.name || !values.slug || !values['cf-project'] || !values.email || !values.password) {
  console.error('Error: --name, --slug, --cf-project, --email, --password are all required')
  process.exit(1)
}

async function login() {
  const res = await fetch(`${PAYLOAD_API_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: PAYLOAD_API_EMAIL, password: PAYLOAD_API_PASSWORD }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Login failed: ${JSON.stringify(data)}`)
  return data.token
}

async function run() {
  console.log(`\nProvisioning: ${values.name} (${values.slug})`)
  const token = await login()
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  // 1. Create tenant
  const tenantRes = await fetch(`${PAYLOAD_API_URL}/api/tenants`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: values.name,
      slug: values.slug,
      cfPagesProject: values['cf-project'],
    }),
  })
  const tenantData = await tenantRes.json()
  if (!tenantRes.ok) throw new Error(`Failed to create tenant: ${JSON.stringify(tenantData)}`)
  const tenantId = tenantData.doc.id
  console.log(`✓ Tenant created (id: ${tenantId})`)

  // 2. Create client user
  const userRes = await fetch(`${PAYLOAD_API_URL}/api/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: values.email,
      password: values.password,
      role: 'user',
      // The multi-tenant plugin expects the tenants field in this format:
      tenants: [{ tenant: tenantId }],
    }),
  })
  const userData = await userRes.json()
  if (!userRes.ok) throw new Error(`Failed to create user: ${JSON.stringify(userData)}`)
  console.log(`✓ User created (${values.email})`)

  // 3. Create empty DentalSite record for the tenant
  const siteRes = await fetch(`${PAYLOAD_API_URL}/api/dental-sites`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tenant: tenantId,
      practiceName: values.name,
      hero: { headlineLight: '', headlineHeavy: '', subtext: '', cta: 'Maak een afspraak' },
      contact: { phone: '', email: values.email, hours: '' },
      services: [],
    }),
  })
  const siteData = await siteRes.json()
  if (!siteRes.ok) throw new Error(`Failed to create dental site: ${JSON.stringify(siteData)}`)
  console.log(`✓ DentalSite record created (id: ${siteData.doc.id})`)

  console.log(`
Done. New client summary:
  Tenant:       ${values.name} (${values.slug})
  CMS login:    ${PAYLOAD_API_URL}/admin
  Email:        ${values.email}
  CF project:   ${values['cf-project']}
`)
}

run().catch(err => { console.error('\n✗ Error:', err.message); process.exit(1) })
```

- [ ] **Step 2: Test the script against the deployed Payload instance**

```bash
PAYLOAD_API_URL=https://autosite-payload-cms.<subdomain>.workers.dev \
PAYLOAD_API_EMAIL=admin@foove.nl \
PAYLOAD_API_PASSWORD=<your-admin-password> \
node scripts/provision-payload.js \
  --name "Spike Test Praktijk" \
  --slug spike-test \
  --cf-project dentist-spike-test \
  --email test@spikepraktijk.nl \
  --password test-pass-123
```

Expected:
```
Provisioning: Spike Test Praktijk (spike-test)
✓ Tenant created (id: ...)
✓ User created (test@spikepraktijk.nl)
✓ DentalSite record created (id: ...)

Done. New client summary:
  Tenant:       Spike Test Praktijk (spike-test)
  CMS login:    https://...workers.dev/admin
  Email:        test@spikepraktijk.nl
  CF project:   dentist-spike-test
```

Verify in the deployed admin: log in as `admin@foove.nl`, check Tenants and DentalSites. Then open a private window, log in as `test@spikepraktijk.nl` — they should see only the Spike Test Praktijk record.

- [ ] **Step 3: Commit**

```bash
git add scripts/provision-payload.js
git commit -m "spike: add Payload provisioning script"
```

---

## Task 8: Template propagation script

**Files:**
- Create: `scripts/trigger-payload-rebuilds.js`

- [ ] **Step 1: Create the propagation script**

Create `scripts/trigger-payload-rebuilds.js`:

```javascript
#!/usr/bin/env node
// Triggers a GitHub Actions rebuild for all active tenants.
// Use this when the Astro template is updated and all client sites need rebuilding.
//
// Usage:
//   PAYLOAD_API_URL=https://... PAYLOAD_API_EMAIL=... PAYLOAD_API_PASSWORD=... \
//   GITHUB_TOKEN=<pat> GITHUB_REPO=masidawoud/autosite \
//   node scripts/trigger-payload-rebuilds.js

const { PAYLOAD_API_URL, PAYLOAD_API_EMAIL, PAYLOAD_API_PASSWORD, GITHUB_TOKEN, GITHUB_REPO } = process.env

if (!PAYLOAD_API_URL || !PAYLOAD_API_EMAIL || !PAYLOAD_API_PASSWORD || !GITHUB_TOKEN || !GITHUB_REPO) {
  console.error('PAYLOAD_API_URL, PAYLOAD_API_EMAIL, PAYLOAD_API_PASSWORD, GITHUB_TOKEN, GITHUB_REPO must be set')
  process.exit(1)
}

async function login() {
  const res = await fetch(`${PAYLOAD_API_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: PAYLOAD_API_EMAIL, password: PAYLOAD_API_PASSWORD }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Login failed: ${JSON.stringify(data)}`)
  return data.token
}

async function fetchAllTenants(token) {
  const res = await fetch(`${PAYLOAD_API_URL}/api/tenants?limit=200&depth=0`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return data.docs
}

async function dispatchBuild(slug, cfProject) {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/build-from-payload.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        ref: 'master',
        inputs: { client_id: slug, cf_project_name: cfProject },
      }),
    }
  )
  return res.ok
}

async function run() {
  const token = await login()
  const tenants = await fetchAllTenants(token)
  console.log(`Found ${tenants.length} tenants. Dispatching builds in parallel...`)

  const results = await Promise.all(
    tenants.map(async (t) => {
      const ok = await dispatchBuild(t.slug, t.cfPagesProject)
      console.log(`  ${ok ? '✓' : '✗'} ${t.slug} (${t.cfPagesProject})`)
      return { slug: t.slug, ok }
    })
  )

  const failed = results.filter(r => !r.ok)
  if (failed.length > 0) {
    console.error(`\n${failed.length} dispatch(es) failed:`, failed.map(r => r.slug).join(', '))
    process.exit(1)
  }
  console.log(`\n✓ All ${tenants.length} builds dispatched.`)
}

run().catch(err => { console.error(err.message); process.exit(1) })
```

- [ ] **Step 2: Test with existing tenants**

```bash
PAYLOAD_API_URL=https://autosite-payload-cms.<subdomain>.workers.dev \
PAYLOAD_API_EMAIL=admin@foove.nl \
PAYLOAD_API_PASSWORD=<admin-password> \
GITHUB_TOKEN=<your-github-pat> \
GITHUB_REPO=masidawoud/autosite \
node scripts/trigger-payload-rebuilds.js
```

Expected:
```
Found 3 tenants. Dispatching builds in parallel...
  ✓ lie-dental (dentist-lie-dental)
  ✓ test-praktijk (dentist-test-praktijk)
  ✓ spike-test (dentist-spike-test)

✓ All 3 builds dispatched.
```

Check GitHub Actions UI — 3 `build-from-payload.yml` runs should be in progress simultaneously.

- [ ] **Step 3: Commit**

```bash
git add scripts/trigger-payload-rebuilds.js
git commit -m "spike: add template propagation script"
```

---

## Task 9: Spike verdict

**Files:**
- Create: `docs/superpowers/specs/2026-03-26-payload-spike-verdict.md`

- [ ] **Step 1: Check all success criteria**

Go through each item in the "Spike success criteria" section at the top of this document. Mark pass or fail. Document any failures with the error message and what was tried.

- [ ] **Step 2: Estimate monthly cost**

Check the Cloudflare dashboard:
- Workers Paid plan: $5/month base (required for Workers + D1 in production)
- D1 usage: at 3 test tenants, well within the free tier for D1 reads/writes
- At 100 clients: estimate ~1M DB reads/month → still within D1 free tier (25B row reads/month)

Total estimate at 100 clients: **$5–10/month** (Workers paid plan + D1 usage).

- [ ] **Step 3: Write the verdict doc**

Create `docs/superpowers/specs/2026-03-26-payload-spike-verdict.md`:

```markdown
# Payload CMS Spike Verdict
_Date: 2026-03-26_

## Success criteria

| Criterion | Pass/Fail | Notes |
|---|---|---|
| Payload admin loads at Workers URL with email+password login | | |
| Two test tenants isolated (each sees only their content) | | |
| Operator super-admin sees all tenants | | |
| Provisioning script creates new client in <5 minutes | | |
| GitHub Actions build fetches content from Payload, builds Astro, deploys | | |
| trigger-payload-rebuilds.js dispatches all builds in parallel | | |
| Monthly cost under €30 | | |

## Blockers encountered

(fill in)

## Recommendation

- [ ] PROCEED — migrate from Sveltia + Gitea to Payload before 50 clients
- [ ] DO NOT PROCEED — stay on Sveltia + Gitea; reason: ___
- [ ] PARTIAL — proceed with modifications: ___

## Estimated migration effort (if proceeding)

(fill in: days to build full content schema, admin customizations, provisioning integration)
```

- [ ] **Step 4: Commit and push branch**

```bash
git add docs/superpowers/specs/2026-03-26-payload-spike-verdict.md
git commit -m "spike: add verdict document"
git push origin spike/payload-cms
```

---

## Reference documentation

- **Payload D1 adapter:** `@payloadcms/db-d1-sqlite` — https://github.com/payloadcms/payload/blob/v3.79.1/docs/database/sqlite.mdx
- **Multi-tenant plugin:** `@payloadcms/plugin-multi-tenant` — https://github.com/payloadcms/payload/blob/v3.79.1/docs/plugins/multi-tenant.mdx
- **Cloudflare D1 template:** https://github.com/payloadcms/payload/tree/v3.79.1/templates/with-cloudflare-d1
- **Multi-tenant example:** https://github.com/payloadcms/payload/tree/v3.79.1/examples/multi-tenant
- **Access control patterns:** https://github.com/payloadcms/payload/blob/v3.79.1/docs/access-control/overview.mdx
- **CMS research findings:** `docs/superpowers/specs/2026-03-26-cms-research-findings.md`
- **Template architecture brainstorm:** `docs/superpowers/specs/2026-03-26-template-architecture-brainstorm.md`
