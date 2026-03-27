# Spike 1-3: Pages Collection + SiteSettings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `DentalSites` collection with a `Pages` collection (one document per page, blocks layout) and a `SiteSettings` collection (one document per tenant: business info, theme, footer), giving clients a proper list-based page editor in the Payload admin.

**Architecture:** `Pages` is a multi-tenant collection where each document represents one page (slug `home`, `over-ons`, etc.) with a `layout` blocks field containing the same 9 blocks from spike 1-2. `SiteSettings` is a multi-tenant collection acting as a per-tenant singleton holding business info, contact details (phone + email only), theme, and footer. Both collections fire the same afterChange build dispatch hook. The shared dispatch logic lives in `payload-cms/src/lib/dispatchBuild.ts`. A new D1 migration drops all `dental_sites*` tables and creates `pages`, `pages_blocks_*`, and `site_settings` tables. The GitHub Actions workflow is updated to fetch from both new endpoints.

**Tech Stack:** Payload CMS v3, Cloudflare Workers, Cloudflare D1 (SQLite), `@payloadcms/db-d1-sqlite`, `@payloadcms/plugin-multi-tenant`, GitHub Actions

---

## File Structure

**Create:**
- `payload-cms/src/lib/dispatchBuild.ts` — shared build dispatch utility (extracted from DentalSites)
- `payload-cms/src/collections/Pages.ts` — Pages collection (title, slug, layout blocks)
- `payload-cms/src/collections/SiteSettings.ts` — SiteSettings collection (business, contact, theme, footer)
- `payload-cms/src/migrations/20260327_300000_pages_and_site_settings.ts` — D1 migration

**Modify:**
- `payload-cms/src/payload.config.ts` — swap DentalSites for Pages + SiteSettings
- `payload-cms/src/migrations/index.ts` — register new migration
- `.github/workflows/build-from-payload.yml` — fetch from site-settings + pages instead of dental-sites
- `payload-cms/src/collections/DentalSites.ts` — **delete this file**

---

## Task 1: Create shared `dispatchBuild` utility

**Files:**
- Create: `payload-cms/src/lib/dispatchBuild.ts`

The `DentalSites.ts` file has inline dispatch logic. Both `Pages` and `SiteSettings` need the same logic. Extract it to a shared module first so the collection files can import it cleanly.

- [ ] **Step 1: Create the lib directory and file**

```typescript
// payload-cms/src/lib/dispatchBuild.ts

const GITHUB_REPO = 'masidawoud/autosite'
const WORKFLOW_FILE = 'build-from-payload.yml'

export async function dispatchBuild(slug: string, cfPagesProject: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.warn('[dispatchBuild] GITHUB_TOKEN is not set — skipping build dispatch')
    return
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`
  const body = JSON.stringify({
    ref: 'master',
    inputs: { client_id: slug, cf_project_name: cfPagesProject },
  })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'autosite-payload-cms',
      },
      body,
    })
    if (res.ok || res.status === 204) {
      console.log(`[dispatchBuild] Build dispatched for tenant="${slug}" cf_project="${cfPagesProject}"`)
    } else {
      const text = await res.text()
      console.error(`[dispatchBuild] GitHub dispatch failed — status=${res.status} body=${text}`)
    }
  } catch (err) {
    console.error('[dispatchBuild] fetch threw:', err)
  }
}

export async function dispatchBuildForDoc(doc: any, req: any): Promise<void> {
  try {
    let slug: string | undefined
    let cfPagesProject: string | undefined

    if (doc.tenant && typeof doc.tenant === 'object') {
      slug = doc.tenant.slug
      cfPagesProject = doc.tenant.cfPagesProject
    } else if (doc.tenant) {
      const tenant = await req.payload.findByID({
        collection: 'tenants',
        id: doc.tenant,
        overrideAccess: true,
      })
      slug = (tenant as any)?.slug
      cfPagesProject = (tenant as any)?.cfPagesProject
    }

    if (!slug || !cfPagesProject) {
      console.warn('[dispatchBuild] tenant slug or cfPagesProject missing — skipping', {
        docId: doc.id,
        tenant: doc.tenant,
      })
      return
    }

    await dispatchBuild(slug, cfPagesProject)
  } catch (err) {
    console.error('[dispatchBuild] dispatchBuildForDoc error:', err)
  }
}
```

- [ ] **Step 2: Verify the file compiles (no TypeScript errors)**

Run from `payload-cms/`:
```bash
npx tsc --noEmit
```
Expected: no errors relating to `src/lib/dispatchBuild.ts`

- [ ] **Step 3: Commit**

```bash
git add payload-cms/src/lib/dispatchBuild.ts
git commit -m "feat: extract dispatchBuild to shared utility"
```

---

## Task 2: Create `Pages` collection

**Files:**
- Create: `payload-cms/src/collections/Pages.ts`

The `Pages` collection has two main fields: `title` (display name in admin list) and `slug` (used by the workflow to find the home page: `where[slug][equals]=home`). The `layout` blocks field holds the same 9 blocks as the old `sections` field in DentalSites. Multi-tenant filtering is applied by the plugin (configured in Task 4).

- [ ] **Step 1: Create `payload-cms/src/collections/Pages.ts`**

```typescript
import type { CollectionConfig } from 'payload'
import { HeroBlock } from '../blocks/HeroBlock'
import { QuoteBlock } from '../blocks/QuoteBlock'
import { FeaturesBlock } from '../blocks/FeaturesBlock'
import { ServicesBlock } from '../blocks/ServicesBlock'
import { TeamBlock } from '../blocks/TeamBlock'
import { ReviewsBlock } from '../blocks/ReviewsBlock'
import { HoursBlock } from '../blocks/HoursBlock'
import { VergoedingBlock } from '../blocks/VergoedingBlock'
import { ContactBlock } from '../blocks/ContactBlock'
import { dispatchBuildForDoc } from '../lib/dispatchBuild'

const isSuperAdmin = ({ req: { user } }: any) => (user as any)?.role === 'super-admin'
const isLoggedIn = ({ req: { user } }: any) => Boolean(user)

export const Pages: CollectionConfig = {
  slug: 'pages',
  lockDocuments: false,
  admin: {
    useAsTitle: 'title',
    group: 'Inhoud',
  },
  access: {
    create: isSuperAdmin,
    read: isLoggedIn,
    update: isLoggedIn,
    delete: isSuperAdmin,
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'update') return
        await dispatchBuildForDoc(doc, req)
      },
    ],
  },
  fields: [
    {
      name: 'title',
      label: 'Paginatitel',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      required: true,
      admin: {
        description: 'URL-identifier, e.g. "home" or "over-ons". Use lowercase, no spaces.',
      },
    },
    {
      name: 'layout',
      label: 'Secties',
      type: 'blocks',
      minRows: 0,
      maxRows: 20,
      blocks: [
        HeroBlock,
        QuoteBlock,
        FeaturesBlock,
        ServicesBlock,
        TeamBlock,
        ReviewsBlock,
        HoursBlock,
        VergoedingBlock,
        ContactBlock,
      ],
    },
  ],
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd payload-cms && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add payload-cms/src/collections/Pages.ts
git commit -m "feat: add Pages collection with layout blocks field"
```

---

## Task 3: Create `SiteSettings` collection

**Files:**
- Create: `payload-cms/src/collections/SiteSettings.ts`

`SiteSettings` holds all the non-page content: practice name, business details, contact info (phone + email only — section copy like eyebrow/title/intro lives in the ContactBlock), theme, and footer meta. One document per tenant. Multi-tenant filtering applied by the plugin.

- [ ] **Step 1: Create `payload-cms/src/collections/SiteSettings.ts`**

```typescript
import type { CollectionConfig } from 'payload'
import { dispatchBuildForDoc } from '../lib/dispatchBuild'

const isSuperAdmin = ({ req: { user } }: any) => (user as any)?.role === 'super-admin'
const isLoggedIn = ({ req: { user } }: any) => Boolean(user)

export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  lockDocuments: false,
  admin: {
    useAsTitle: 'practiceName',
    group: 'Instellingen',
  },
  access: {
    create: isSuperAdmin,
    read: isLoggedIn,
    update: isLoggedIn,
    delete: isSuperAdmin,
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'update') return
        await dispatchBuildForDoc(doc, req)
      },
    ],
  },
  fields: [
    {
      name: 'practiceName',
      label: 'Praktijknaam',
      type: 'text',
      required: true,
    },
    {
      name: 'business',
      label: 'Bedrijfsgegevens',
      type: 'group',
      fields: [
        { name: 'city', label: 'Stad', type: 'text' },
        { name: 'address', label: 'Adres', type: 'text' },
        { name: 'postalCode', label: 'Postcode', type: 'text' },
        { name: 'googleReviewsScore', label: 'Google Reviews Score', type: 'text' },
        { name: 'googleReviewsCount', label: 'Google Reviews Aantal', type: 'number' },
        { name: 'googleReviewsUrl', label: 'Google Reviews URL', type: 'text' },
      ],
    },
    {
      name: 'contact',
      label: 'Contact',
      type: 'group',
      fields: [
        { name: 'phone', label: 'Telefoon', type: 'text' },
        { name: 'email', label: 'E-mailadres', type: 'email' },
      ],
    },
    {
      name: 'theme',
      label: 'Thema',
      type: 'group',
      fields: [
        {
          name: 'stylePreset',
          label: 'Stijl Preset',
          type: 'select',
          options: [
            { label: 'Warm Editorial', value: 'warm-editorial' },
            { label: 'Ocean Depths', value: 'ocean-depths' },
            { label: 'Tech Innovation', value: 'tech-innovation' },
          ],
        },
        {
          name: 'accentColor',
          label: 'Accentkleur (hex)',
          type: 'text',
          admin: { placeholder: '#2D7A6C' },
        },
        {
          name: 'accentHoverColor',
          label: 'Accentkleur Hover (hex)',
          type: 'text',
        },
      ],
    },
    {
      name: 'footer',
      label: 'SEO & Footer',
      type: 'group',
      fields: [
        { name: 'metaTitle', label: 'Meta Title', type: 'text' },
        { name: 'metaDescription', label: 'Meta Description', type: 'textarea' },
        { name: 'tagline', label: 'Tagline', type: 'text' },
      ],
    },
  ],
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd payload-cms && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add payload-cms/src/collections/SiteSettings.ts
git commit -m "feat: add SiteSettings collection (business, contact, theme, footer)"
```

---

## Task 4: Update `payload.config.ts`

**Files:**
- Modify: `payload-cms/src/payload.config.ts`

Swap `DentalSites` for `Pages` and `SiteSettings` in the collections array. Update `multiTenantPlugin` to apply to both new collections. Delete `DentalSites.ts`.

- [ ] **Step 1: Update `payload-cms/src/payload.config.ts`**

Replace the imports and collections array. The full file after changes:

```typescript
import fs from 'fs'
import path from 'path'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { CloudflareContext, getCloudflareContext } from '@opennextjs/cloudflare'
import { GetPlatformProxyOptions } from 'wrangler'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'

import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { Pages } from './collections/Pages'
import { SiteSettings } from './collections/SiteSettings'
import type { Config } from './payload-types'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const realpath = (value: string) => (fs.existsSync(value) ? fs.realpathSync(value) : undefined)

const isCLI = process.argv.some((value) => realpath(value)?.endsWith(path.join('payload', 'bin.js')))
const isProduction = process.env.NODE_ENV === 'production'

const createLog =
  (level: string, fn: typeof console.log) => (objOrMsg: object | string, msg?: string) => {
    if (typeof objOrMsg === 'string') {
      fn(JSON.stringify({ level, msg: objOrMsg }))
    } else {
      fn(JSON.stringify({ level, ...objOrMsg, msg: msg ?? (objOrMsg as { msg?: string }).msg }))
    }
  }

const cloudflareLogger = {
  level: process.env.PAYLOAD_LOG_LEVEL || 'info',
  trace: createLog('trace', console.debug),
  debug: createLog('debug', console.debug),
  info: createLog('info', console.log),
  warn: createLog('warn', console.warn),
  error: createLog('error', console.error),
  fatal: createLog('fatal', console.error),
  silent: () => {},
} as any

const cloudflare =
  isCLI || !isProduction
    ? await getCloudflareContextFromWrangler()
    : await getCloudflareContext({ async: true })

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Tenants, Users, Pages, SiteSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'spike-change-in-prod',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteD1Adapter({
    binding: cloudflare.env.D1,
  }),
  logger: isProduction ? cloudflareLogger : undefined,
  plugins: [
    multiTenantPlugin<Config>({
      collections: {
        'pages': {},
        'site-settings': {},
      },
      tenantsArrayField: {
        includeDefaultField: true,
        arrayFieldName: 'tenants',
      },
      userHasAccessToAllTenants: (user) => (user as any)?.role === 'super-admin',
    }),
  ],
})

function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  return import(/* webpackIgnore: true */ `${'__wrangler'.replaceAll('_', '')}`).then(
    ({ getPlatformProxy }) =>
      getPlatformProxy({
        environment: process.env.CLOUDFLARE_ENV,
        remoteBindings: isProduction,
      } satisfies GetPlatformProxyOptions),
  )
}
```

- [ ] **Step 2: Delete `payload-cms/src/collections/DentalSites.ts`**

```bash
rm payload-cms/src/collections/DentalSites.ts
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd payload-cms && npx tsc --noEmit
```
Expected: no errors. If `payload-types.ts` references `DentalSites`, those errors are expected and will be resolved after applying the migration and regenerating types.

- [ ] **Step 4: Commit**

```bash
git add payload-cms/src/payload.config.ts
git rm payload-cms/src/collections/DentalSites.ts
git commit -m "feat: swap DentalSites for Pages + SiteSettings in config"
```

---

## Task 5: Write D1 migration

**Files:**
- Create: `payload-cms/src/migrations/20260327_300000_pages_and_site_settings.ts`
- Modify: `payload-cms/src/migrations/index.ts`

This migration:
1. Creates `pages` table
2. Creates all `pages_blocks_*` tables (same structure as old `dental_sites_blocks_*` but FK points to `pages`)
3. Creates `site_settings` table
4. Adds `pages_id` and `site_settings_id` columns to `payload_locked_documents_rels`
5. Drops all `dental_sites_blocks_*` tables (and sub-tables) in dependency order
6. Drops `dental_sites` table
7. Drops `dental_sites_id` column from `payload_locked_documents_rels`

**Critical rules (from docs/patterns/payload-d1-gotchas.md):**
- Top-level block tables use `{collection}_blocks_{blockSlug}` — here `pages_blocks_hero` etc.
- Every top-level block table needs a `block_name text` column
- Nested array tables (items, members, etc.) do NOT need `block_name`
- Drop order: deepest child tables first, then parents

- [ ] **Step 1: Create the migration file**

```typescript
// payload-cms/src/migrations/20260327_300000_pages_and_site_settings.ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {

  // ── 1. Create `pages` table ─────────────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`title\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`tenant_id\` integer,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_updated_at_idx\` ON \`pages\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_created_at_idx\` ON \`pages\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_tenant_idx\` ON \`pages\` (\`tenant_id\`);`)

  // ── 2. Create pages_blocks_* tables ────────────────────────────────────────

  // HeroBlock
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_hero\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`headline\` text,
    \`description\` text,
    \`cta_primary\` text DEFAULT 'Maak een afspraak',
    \`cta_secondary\` text DEFAULT 'Bel ons',
    \`image_url\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hero_order_idx\` ON \`pages_blocks_hero\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hero_parent_id_idx\` ON \`pages_blocks_hero\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hero_path_idx\` ON \`pages_blocks_hero\` (\`_path\`);`)

  // QuoteBlock
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_quote\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`text\` text,
    \`author_name\` text,
    \`author_role\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_quote_order_idx\` ON \`pages_blocks_quote\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_quote_parent_id_idx\` ON \`pages_blocks_quote\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_quote_path_idx\` ON \`pages_blocks_quote\` (\`_path\`);`)

  // FeaturesBlock (top-level + items sub-table)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_features\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`subtitle\` text,
    \`image_url\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_features_order_idx\` ON \`pages_blocks_features\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_features_parent_id_idx\` ON \`pages_blocks_features\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_features_path_idx\` ON \`pages_blocks_features\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_features_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`icon\` text,
    \`title\` text,
    \`desc\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_features\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_features_items_order_idx\` ON \`pages_blocks_features_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_features_items_parent_id_idx\` ON \`pages_blocks_features_items\` (\`_parent_id\`);`)

  // ServicesBlock (top-level + items + items_bullets)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_services\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`subtitle\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_order_idx\` ON \`pages_blocks_services\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_parent_id_idx\` ON \`pages_blocks_services\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_path_idx\` ON \`pages_blocks_services\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_services_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`tag\` text,
    \`title\` text,
    \`desc\` text,
    \`image_url\` text,
    \`cta\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_items_order_idx\` ON \`pages_blocks_services_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_items_parent_id_idx\` ON \`pages_blocks_services_items\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_services_items_bullets\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_services_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_items_bullets_order_idx\` ON \`pages_blocks_services_items_bullets\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_services_items_bullets_parent_id_idx\` ON \`pages_blocks_services_items_bullets\` (\`_parent_id\`);`)

  // TeamBlock (top-level + members)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_team\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`subtitle\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_team_order_idx\` ON \`pages_blocks_team\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_team_parent_id_idx\` ON \`pages_blocks_team\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_team_path_idx\` ON \`pages_blocks_team\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_team_members\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    \`role\` text,
    \`bio\` text,
    \`image_url\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_team\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_team_members_order_idx\` ON \`pages_blocks_team_members\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_team_members_parent_id_idx\` ON \`pages_blocks_team_members\` (\`_parent_id\`);`)

  // ReviewsBlock (top-level + items)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_reviews\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`title\` text,
    \`subtitle\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_reviews_order_idx\` ON \`pages_blocks_reviews\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_reviews_parent_id_idx\` ON \`pages_blocks_reviews\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_reviews_path_idx\` ON \`pages_blocks_reviews\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_reviews_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    \`stars\` integer,
    \`date\` text,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_reviews\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_reviews_items_order_idx\` ON \`pages_blocks_reviews_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_reviews_items_parent_id_idx\` ON \`pages_blocks_reviews_items\` (\`_parent_id\`);`)

  // HoursBlock (top-level + items)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_hours\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hours_order_idx\` ON \`pages_blocks_hours\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hours_parent_id_idx\` ON \`pages_blocks_hours\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hours_path_idx\` ON \`pages_blocks_hours\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_hours_items\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`day\` text,
    \`time\` text,
    \`open\` integer DEFAULT 1,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_hours\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hours_items_order_idx\` ON \`pages_blocks_hours_items\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_hours_items_parent_id_idx\` ON \`pages_blocks_hours_items\` (\`_parent_id\`);`)

  // VergoedingBlock (top-level + info_blocks + insurers)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_vergoeding\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`intro\` text,
    \`cta\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_order_idx\` ON \`pages_blocks_vergoeding\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_parent_id_idx\` ON \`pages_blocks_vergoeding\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_path_idx\` ON \`pages_blocks_vergoeding\` (\`_path\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_vergoeding_info_blocks\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`title\` text,
    \`text\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_vergoeding\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_info_blocks_order_idx\` ON \`pages_blocks_vergoeding_info_blocks\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_info_blocks_parent_id_idx\` ON \`pages_blocks_vergoeding_info_blocks\` (\`_parent_id\`);`)

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_vergoeding_insurers\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages_blocks_vergoeding\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_insurers_order_idx\` ON \`pages_blocks_vergoeding_insurers\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_vergoeding_insurers_parent_id_idx\` ON \`pages_blocks_vergoeding_insurers\` (\`_parent_id\`);`)

  // ContactBlock
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`pages_blocks_contact\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` integer NOT NULL,
    \`_path\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`eyebrow\` text,
    \`title\` text,
    \`intro\` text,
    \`block_name\` text,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`pages\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_contact_order_idx\` ON \`pages_blocks_contact\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_contact_parent_id_idx\` ON \`pages_blocks_contact\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`pages_blocks_contact_path_idx\` ON \`pages_blocks_contact\` (\`_path\`);`)

  // ── 3. Create `site_settings` table ────────────────────────────────────────
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`site_settings\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`practice_name\` text NOT NULL,
    \`business_city\` text,
    \`business_address\` text,
    \`business_postal_code\` text,
    \`business_google_reviews_score\` text,
    \`business_google_reviews_count\` integer,
    \`business_google_reviews_url\` text,
    \`contact_phone\` text,
    \`contact_email\` text,
    \`theme_style_preset\` text,
    \`theme_accent_color\` text,
    \`theme_accent_hover_color\` text,
    \`footer_meta_title\` text,
    \`footer_meta_description\` text,
    \`footer_tagline\` text,
    \`tenant_id\` integer,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`site_settings_updated_at_idx\` ON \`site_settings\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`site_settings_created_at_idx\` ON \`site_settings\` (\`created_at\`);`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`site_settings_tenant_idx\` ON \`site_settings\` (\`tenant_id\`);`)

  // ── 4. Add pages_id + site_settings_id to payload_locked_documents_rels ────
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`pages_id\` integer;`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_pages_id_idx\` ON \`payload_locked_documents_rels\` (\`pages_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD COLUMN \`site_settings_id\` integer;`)
  await db.run(sql`CREATE INDEX IF NOT EXISTS \`payload_locked_documents_rels_site_settings_id_idx\` ON \`payload_locked_documents_rels\` (\`site_settings_id\`);`)

  // ── 5. Drop dental_sites_blocks_* tables (deepest first) ───────────────────
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_services_items_bullets\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_services_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_services\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_features_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_features\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_team_members\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_team\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_reviews_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_reviews\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_hours_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_hours\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_vergoeding_info_blocks\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_vergoeding_insurers\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_vergoeding\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_contact\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_quote\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites_blocks_hero\`;`)

  // ── 6. Drop dental_sites table ──────────────────────────────────────────────
  await db.run(sql`DROP TABLE IF EXISTS \`dental_sites\`;`)

  // ── 7. Drop dental_sites_id from payload_locked_documents_rels ─────────────
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`dental_sites_id\`;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Re-create dental_sites (minimal — just enough to reverse the drop)
  await db.run(sql`CREATE TABLE IF NOT EXISTS \`dental_sites\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`practice_name\` text NOT NULL,
    \`tenant_id\` integer,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON UPDATE no action ON DELETE set null
  );`)

  // Drop new tables
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_contact\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_vergoeding_insurers\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_vergoeding_info_blocks\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_vergoeding\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_hours_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_hours\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_reviews_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_reviews\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_team_members\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_team\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_services_items_bullets\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_services_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_services\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_features_items\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_features\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_quote\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages_blocks_hero\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`pages\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`site_settings\`;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`pages_id\`;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` DROP COLUMN \`site_settings_id\`;`)
}
```

- [ ] **Step 2: Register migration in `payload-cms/src/migrations/index.ts`**

```typescript
import * as migration_20260326_000000_autosite_schema from './20260326_000000_autosite_schema'
import * as migration_20260326_120000_dental_sites_full_schema from './20260326_120000_dental_sites_full_schema'
import * as migration_20260327_100000_add_sections_blocks from './20260327_100000_add_sections_blocks'
import * as migration_20260327_200000_fix_blocks_table_names from './20260327_200000_fix_blocks_table_names'
import * as migration_20260327_300000_pages_and_site_settings from './20260327_300000_pages_and_site_settings'

export const migrations = [
  {
    up: migration_20260326_000000_autosite_schema.up,
    down: migration_20260326_000000_autosite_schema.down,
    name: '20260326_000000_autosite_schema',
  },
  {
    up: migration_20260326_120000_dental_sites_full_schema.up,
    down: migration_20260326_120000_dental_sites_full_schema.down,
    name: '20260326_120000_dental_sites_full_schema',
  },
  {
    up: migration_20260327_100000_add_sections_blocks.up,
    down: migration_20260327_100000_add_sections_blocks.down,
    name: '20260327_100000_add_sections_blocks',
  },
  {
    up: migration_20260327_200000_fix_blocks_table_names.up,
    down: migration_20260327_200000_fix_blocks_table_names.down,
    name: '20260327_200000_fix_blocks_table_names',
  },
  {
    up: migration_20260327_300000_pages_and_site_settings.up,
    down: migration_20260327_300000_pages_and_site_settings.down,
    name: '20260327_300000_pages_and_site_settings',
  },
]
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd payload-cms && npx tsc --noEmit
```
Expected: no errors in migration files

- [ ] **Step 4: Commit**

```bash
git add payload-cms/src/migrations/20260327_300000_pages_and_site_settings.ts payload-cms/src/migrations/index.ts
git commit -m "feat: add D1 migration for pages + site_settings tables, drop dental_sites"
```

---

## Task 6: Apply migration + deploy CMS

**Files:**
- No code changes — run commands only

Apply the migration to the remote D1 database, then deploy the updated CMS worker.

- [ ] **Step 1: Apply the migration**

Run from `payload-cms/`:
```bash
NODE_ENV=production PAYLOAD_SECRET=ignore pnpm payload migrate
```

Expected output:
```
Running migration: 20260327_300000_pages_and_site_settings
Migration 20260327_300000_pages_and_site_settings applied successfully
```

If you see errors about existing tables, it means a previous partial attempt ran. Check D1 state with:
```bash
npx wrangler d1 execute D1 --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

- [ ] **Step 2: Verify new tables exist**

```bash
npx wrangler d1 execute D1 --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('pages','site_settings','pages_blocks_hero') ORDER BY name;"
```
Expected:
```
pages
pages_blocks_hero
site_settings
```

- [ ] **Step 3: Verify dental_sites is gone**

```bash
npx wrangler d1 execute D1 --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'dental_sites%';"
```
Expected: empty result set (no rows)

- [ ] **Step 4: Deploy updated CMS**

Run from `payload-cms/`:
```bash
pnpm run deploy
```
Expected: Deployment successful to `https://autosite-payload-cms.peachsquad.workers.dev`

- [ ] **Step 5: Verify admin shows new collections**

Open `https://autosite-payload-cms.peachsquad.workers.dev/admin`. Log in. Verify:
- Sidebar shows "Pagina's" under "Inhoud" group
- Sidebar shows "Site-instellingen" under "Instellingen" group
- "Dental Sites" is gone

- [ ] **Step 6: Seed lie-dental SiteSettings**

In the admin, create a new SiteSettings doc:
- Tenant: lie-dental
- Praktijknaam: Lie Dental
- Fill in business, contact, theme, footer fields with the same values as the old DentalSites record

- [ ] **Step 7: Seed lie-dental Home page**

Create a new Pages doc:
- Tenant: lie-dental
- Paginatitel: Home
- Slug: `home`
- Add the same blocks you had in the old DentalSites Pagina-inhoud tab

- [ ] **Step 8: Commit**

No code changes — just the migration was applied remotely.

---

## Task 7: Update GitHub Actions workflow

**Files:**
- Modify: `.github/workflows/build-from-payload.yml`

Replace the single `dental-sites` fetch with two fetches: one to `/api/site-settings` (for business/theme/footer data) and one to `/api/pages?slug=home` (for the layout blocks). Remove the legacy flat-field path entirely — it no longer has a data source.

The sections switch statement (the `case 'hero':`, `case 'quote':` etc.) is **unchanged**. Only the data sources change.

- [ ] **Step 1: Update the "Fetch content from Payload and write data files" step**

Find the step in `.github/workflows/build-from-payload.yml` that starts with `run: |` and contains the Node.js inline script. Replace the entire inline script (from the `node -e "` line to the closing `"`) with:

```yaml
      - name: Fetch content from Payload and write data files
        env:
          PAYLOAD_API_URL: ${{ secrets.PAYLOAD_API_URL }}
          PAYLOAD_API_EMAIL: ${{ secrets.PAYLOAD_API_EMAIL }}
          PAYLOAD_API_PASSWORD: ${{ secrets.PAYLOAD_API_PASSWORD }}
        run: |
          node -e "
          const fs = require('fs');

          function lightenAccent(hex) {
            const h = hex.replace('#', '');
            const r = Math.round(parseInt(h.substring(0,2), 16) * 0.15 + 255 * 0.85).toString(16).padStart(2, '0');
            const g = Math.round(parseInt(h.substring(2,4), 16) * 0.15 + 255 * 0.85).toString(16).padStart(2, '0');
            const b = Math.round(parseInt(h.substring(4,6), 16) * 0.15 + 255 * 0.85).toString(16).padStart(2, '0');
            return '#' + r + g + b;
          }

          function lexicalToText(editorState) {
            if (!editorState || !editorState.root) return '';
            function walk(node) {
              if (node.type === 'text') return node.text || '';
              if (node.children) return node.children.map(walk).join(' ');
              return '';
            }
            return walk(editorState.root).replace(/\s+/g, ' ').trim();
          }

          async function main() {
            // 1. Login
            const loginRes = await fetch(process.env.PAYLOAD_API_URL + '/api/users/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: process.env.PAYLOAD_API_EMAIL,
                password: process.env.PAYLOAD_API_PASSWORD,
              }),
            });
            const loginData = await loginRes.json();
            if (!loginRes.ok) { console.error('Login failed:', loginData); process.exit(1); }
            const token = loginData.token;
            console.log('Logged in successfully');

            const clientId = '${{ inputs.client_id }}';
            const authHeader = { Authorization: 'Bearer ' + token };

            // 2. Fetch SiteSettings for this tenant
            const settingsRes = await fetch(
              process.env.PAYLOAD_API_URL + '/api/site-settings?where[tenant.slug][equals]=' + clientId + '&depth=1&limit=1',
              { headers: authHeader }
            );
            const settingsData = await settingsRes.json();
            if (!settingsData.docs || settingsData.docs.length === 0) {
              console.error('No site-settings found for tenant:', clientId);
              process.exit(1);
            }
            const settings = settingsData.docs[0];
            console.log('Fetched site settings:', settings.practiceName);

            // 3. Write business.json
            const businessJson = {
              name: settings.practiceName || '',
              city: settings.business?.city || '',
              address: settings.business?.address || '',
              postal_code: settings.business?.postalCode || '',
              phone: settings.contact?.phone || '',
              email: settings.contact?.email || '',
              google_reviews_score: settings.business?.googleReviewsScore || '',
              google_reviews_count: settings.business?.googleReviewsCount || 0,
              google_reviews_url: settings.business?.googleReviewsUrl || '#',
            };
            fs.writeFileSync('dental-template/src/data/business.json', JSON.stringify(businessJson, null, 2));
            console.log('business.json written');

            // 4. Write footer.json
            const footerJson = {
              meta_title: settings.footer?.metaTitle || '',
              meta_description: settings.footer?.metaDescription || '',
              tagline: settings.footer?.tagline || '',
              social: [],
            };
            fs.writeFileSync('dental-template/src/data/footer.json', JSON.stringify(footerJson, null, 2));
            console.log('footer.json written');

            // 5. Load theme preset, apply accent overrides, write theme.json
            const stylePreset = settings.theme?.stylePreset || 'warm-editorial';
            const themePresetPath = 'dental-template/src/data/themes/' + stylePreset + '.json';
            const theme = JSON.parse(fs.readFileSync(themePresetPath, 'utf8'));
            if (settings.theme?.accentColor) {
              theme.colors.accent = settings.theme.accentColor;
              theme.colors.accent_light = lightenAccent(settings.theme.accentColor);
            }
            if (settings.theme?.accentHoverColor) {
              theme.colors.accent_hover = settings.theme.accentHoverColor;
            }
            fs.writeFileSync('dental-template/src/data/theme.json', JSON.stringify(theme, null, 2));
            console.log('theme.json written (preset: ' + stylePreset + ')');

            // 6. Fetch home page for this tenant
            const pageRes = await fetch(
              process.env.PAYLOAD_API_URL + '/api/pages?where[and][0][tenant.slug][equals]=' + clientId + '&where[and][1][slug][equals]=home&depth=2&limit=1',
              { headers: authHeader }
            );
            const pageData = await pageRes.json();
            if (!pageData.docs || pageData.docs.length === 0) {
              console.error('No home page found for tenant:', clientId);
              process.exit(1);
            }
            const page = pageData.docs[0];
            console.log('Fetched home page: ' + page.title);

            // 7. Build sections array from layout blocks
            const sections = (page.layout || []).map(function(block) {
              switch (block.blockType) {
                case 'hero':
                  return {
                    type: 'hero', enabled: true,
                    eyebrow: block.eyebrow || '',
                    headline: block.headline || '',
                    description: lexicalToText(block.description),
                    cta_primary: block.ctaPrimary || 'Maak een afspraak',
                    cta_secondary: block.ctaSecondary || 'Bel ons',
                    image_url: block.imageUrl || 'https://picsum.photos/seed/dental-hero/720/860',
                  };
                case 'quote':
                  return {
                    type: 'quote', enabled: true,
                    text: block.text || '',
                    author_name: block.authorName || '',
                    author_role: block.authorRole || '',
                  };
                case 'features':
                  return {
                    type: 'features', enabled: true,
                    eyebrow: block.eyebrow || '',
                    title: block.title || '',
                    subtitle: block.subtitle || '',
                    image_url: block.imageUrl || '',
                    items: (block.items || []).map(function(i) {
                      return { icon: i.icon || '', title: i.title || '', desc: i.desc || '' };
                    }),
                  };
                case 'services':
                  return {
                    type: 'services', enabled: true,
                    eyebrow: block.eyebrow || '',
                    title: block.title || '',
                    subtitle: block.subtitle || '',
                    items: (block.items || []).map(function(i) {
                      return {
                        tag: i.tag || '',
                        title: i.title || '',
                        desc: i.desc || '',
                        image_url: i.imageUrl || '',
                        items: (i.bullets || []).map(function(b) { return b.text || ''; }),
                        cta: i.cta || '',
                      };
                    }),
                  };
                case 'team':
                  return {
                    type: 'team', enabled: true,
                    eyebrow: block.eyebrow || '',
                    title: block.title || '',
                    subtitle: block.subtitle || '',
                    members: (block.members || []).map(function(m) {
                      return {
                        name: m.name || '',
                        role: m.role || '',
                        bio: lexicalToText(m.bio),
                        image_url: m.imageUrl || '',
                      };
                    }),
                  };
                case 'reviews':
                  return {
                    type: 'reviews', enabled: true,
                    title: block.title || '',
                    subtitle: block.subtitle || '',
                    items: (block.items || []).map(function(r) {
                      return { name: r.name || '', stars: r.stars || 0, date: r.date || '', text: r.text || '' };
                    }),
                  };
                case 'hours':
                  return {
                    type: 'hours', enabled: true,
                    items: (block.items || []).map(function(h) {
                      return { day: h.day || '', time: h.time || '', open: h.open !== false };
                    }),
                  };
                case 'vergoeding':
                  return {
                    type: 'vergoeding', enabled: true,
                    eyebrow: block.eyebrow || '',
                    title: block.title || '',
                    intro: lexicalToText(block.intro),
                    blocks: (block.infoBlocks || []).map(function(b) {
                      return { title: b.title || '', text: b.text || '' };
                    }),
                    insurers: (block.insurers || []).map(function(i) { return i.name || ''; }),
                    cta: block.cta || '',
                  };
                case 'contact':
                  return {
                    type: 'contact', enabled: true,
                    eyebrow: block.eyebrow || '',
                    title: block.title || '',
                    intro: lexicalToText(block.intro),
                  };
                default:
                  console.warn('Unknown blockType: ' + block.blockType + ' — skipping');
                  return null;
              }
            }).filter(function(s) { return s !== null; });

            const frontmatter = JSON.stringify({ title: 'Home', published: true, sections: sections });
            const homeMd = '---\n' + frontmatter + '\n---\n\n';
            fs.writeFileSync('dental-template/src/content/pages/home.md', homeMd);
            console.log('home.md written (' + sections.length + ' sections)');
          }

          main().catch(function(err) { console.error(err); process.exit(1); });
          "
```

- [ ] **Step 2: Verify the workflow file has no syntax errors**

```bash
cat .github/workflows/build-from-payload.yml | grep -c "<<<<<"
```
Expected: `0` (no merge conflict markers)

- [ ] **Step 3: Commit and push to master**

```bash
git add .github/workflows/build-from-payload.yml
git commit -m "feat: update workflow to fetch from site-settings + pages instead of dental-sites"
git push origin master
```

---

## Task 8: E2E verify

**Files:** None

Verify the full loop: save in admin → build triggers → site updates.

- [ ] **Step 1: Trigger a build by saving the home page**

In the Payload admin, open the lie-dental Home page and hit Save.

- [ ] **Step 2: Confirm GitHub Actions run started**

```bash
gh run list --limit 3 --json databaseId,status,displayTitle,createdAt
```
Expected: a new in-progress run "Build and deploy from Payload CMS"

- [ ] **Step 3: Watch the run complete**

```bash
gh run watch <run-id>
```
Expected: all steps pass including "Fetch content from Payload and write data files"

If "Fetch content" fails with "No site-settings found" or "No home page found", the seed data from Task 6 is missing. Create the records in the admin and re-trigger.

- [ ] **Step 4: Verify the deploy step used `--branch=main`**

```bash
gh run view <run-id> --log | grep "pages deploy"
```
Expected: `npx wrangler@4 pages deploy dist --project-name=dentist-lie-dental --branch=main`

- [ ] **Step 5: Verify live site reflects CMS content**

Open `https://main.dentist-lie-dental.pages.dev`. Confirm the page content matches what you entered in the admin.

- [ ] **Step 6: Commit nothing — update memory only**

No code changes. The spike is complete. Update `docs/superpowers/plans/2026-03-27-spike-1-3-pages-collection.md` to mark all tasks checked.

---

## Self-Review

**Spec coverage:**
- ✅ Pages collection with blocks layout field
- ✅ SiteSettings collection (business, contact, theme, footer)
- ✅ Multi-tenant filtering on both collections
- ✅ afterChange build dispatch on both collections
- ✅ Shared dispatch utility (no duplication)
- ✅ D1 migration: creates pages + site_settings tables, drops dental_sites
- ✅ Workflow updated to fetch from new endpoints
- ✅ E2E verification

**Placeholder scan:** No TBD, no "implement later", all code steps show complete code.

**Type consistency:**
- `dispatchBuildForDoc` defined in Task 1, imported in Tasks 2 and 3 ✅
- `Pages` collection slug `'pages'` matches multiTenantPlugin key `'pages'` in Task 4 ✅
- `SiteSettings` collection slug `'site-settings'` matches multiTenantPlugin key `'site-settings'` in Task 4 ✅
- Migration table `site_settings` matches Payload's snake_case conversion of slug `site-settings` ✅
- Workflow fetches `/api/site-settings` and `/api/pages` matching the collection slugs ✅
- `page.layout` in workflow matches `layout` field name in Pages collection ✅
