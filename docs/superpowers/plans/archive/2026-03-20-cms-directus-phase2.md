# CMS Directus Phase 2 — Pages + Blocks Implementation Plan

> **STATUS: COMPLETE + PARKED as of 2026-03-21.** All 7 tasks done. Branch `feature/cms-directus-phase2` tagged `phase2-complete`, not merged to master. Directus parked — self-hosted Postgres + schema management deemed overkill. Next direction: TinaCMS self-hosted with alternative auth (no GitHub for clients).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Directus CMS with a `pages` collection and M2A block system so clients can create multi-page sites with draggable section blocks, deployed via the existing GitHub Action.

**Architecture:** A `pages` collection holds ordered M2A block references (junction table `page_section_blocks`). Eleven `block_*` collections each map to an existing Astro component. `fetch-content.js` fetches pages + hydrated blocks from Directus and writes `src/data/pages/{slug}.json`. A new `[...slug].astro` route reads those files and renders each block via `BlockRenderer.astro`. The homepage (`index.astro`) is unchanged in Phase 2 — it continues to render from `site.json`. Additional pages (e.g. `/diensten`, `/over-ons`) are fully block-driven.

**Tech Stack:** Directus v11 REST API, Node.js 20 ESM, `node:test` (unit tests), Astro 4.x `import.meta.glob`, Cloudflare Pages

---

## Preconditions

Phase 1 must be complete:
- Directus live at `https://autosite-cms.fly.dev`
- `site_configs` collection with Client role + row-level permissions working
- `fetch-content.js`, `content-transform.js`, GitHub Action, deploy flow all working
- Demo client `demo-tandarts` exists and end-to-end deploy is verified

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `dental-template/scripts/setup-phase2.js` | **Create** | One-time script: creates block collections, pages collection, junction table fields, Client role permissions |
| `dental-template/scripts/content-transform.js` | **Modify** | Add `transformPages()` function |
| `dental-template/scripts/content-transform.test.js` | **Modify** | Add tests for `transformPages()` |
| `dental-template/scripts/fetch-content.js` | **Modify** | Fetch pages + M2A blocks, write `src/data/pages/{slug}.json` |
| `dental-template/src/pages/[...slug].astro` | **Create** | Static routing for block-driven pages via `import.meta.glob` |
| `dental-template/src/components/BlockRenderer.astro` | **Create** | Maps `block.collection` → correct Astro component |
| `dental-template/src/data/pages/.gitkeep` | **Create** | Keeps directory tracked in git; JSON files are build-time artifacts |

---

## Task 1: Validate M2A PoC (No Code — Manual Directus Test)

**Purpose:** The spec flags M2A as an open question before Phase 2 is built. Validate two things in the live Directus instance before writing any code:
1. The M2A query syntax with per-collection field selectors returns hydrated block data
2. The `owner` field permission filter works on a block collection

**Files:** None

- [ ] **Step 1: Create minimal test collections in Directus UI**

Log into `https://autosite-cms.fly.dev/admin`. Go to Settings → Data Model.

Create a test block collection:
- Name: `poc_block_hero`
- Add field: `headline` (Input, type: string)
- Add field: `owner` (M2O → directus_users, interface: select-dropdown-m2o)
- Add one test record: `headline: "Test Headline"`, leave `owner` null

Create a test pages collection:
- Name: `poc_pages`
- Add field: `slug` (Input, type: string)
- Add field: `blocks` — use interface **Many to Any**, allow collection `poc_block_hero`, junction collection name: `poc_pages_blocks`

Add one test page record: `slug: "poc-test"`. Add a block: pick `poc_block_hero`, fill `headline: "Hello Phase 2"`. Save.

- [ ] **Step 2: Test M2A query syntax**

Run this curl from terminal (replace token):

```bash
curl -H "Authorization: Bearer <DIRECTUS_TOKEN>" \
  "https://autosite-cms.fly.dev/items/poc_pages?fields=slug,blocks.sort,blocks.collection,blocks.item:poc_block_hero.headline"
```

Expected response:
```json
{
  "data": [{
    "slug": "poc-test",
    "blocks": [{
      "sort": null,
      "collection": "poc_block_hero",
      "item": { "headline": "Hello Phase 2" }
    }]
  }]
}
```

If `item` is a UUID string instead of an object → the per-collection field selector syntax needs adjustment. Try:
```bash
# Alternative: explicitly request junction fields
curl -H "Authorization: Bearer <DIRECTUS_TOKEN>" \
  "https://autosite-cms.fly.dev/items/poc_pages?fields=slug,blocks.*,blocks.item:poc_block_hero.*"
```

- [ ] **Step 3: Validate owner permission filter on block collections**

In Directus admin → Settings → Access Control → Client policy → Add permission:
- Collection: `poc_block_hero`
- Action: read
- Field permissions: `*`
- Item permissions: `{"owner":{"_eq":"$CURRENT_USER"}}`

Log in as the demo client (`peachsquad@proton...`). Try to read `poc_block_hero` items via API:

```bash
# As admin: create a poc_block_hero record with owner = demo client's user ID
# Then as demo client, call:
curl -H "Authorization: Bearer <DEMO_CLIENT_TOKEN>" \
  "https://autosite-cms.fly.dev/items/poc_block_hero"
```

Expected: only sees their own record. Other records with owner=null or owner=another user are not returned.

- [ ] **Step 4: Clean up PoC collections**

If both validations pass, delete `poc_block_hero`, `poc_pages`, `poc_pages_blocks` via Settings → Data Model.

If validations fail, note the discrepancy and adjust the Phase 2 plan before continuing.

---

## Task 2: Create Block Collections via Script

**Files:**
- Create: `dental-template/scripts/setup-phase2.js`

Each block collection mirrors the `data` shape accepted by its corresponding Astro component (verified against `site.json`). Each collection also has an `owner` field (M2O → directus_users) for row-level permissions.

- [ ] **Step 1: Create setup-phase2.js**

```javascript
// One-time setup: Phase 2 block collections + pages collection
// Usage: DIRECTUS_URL=https://... DIRECTUS_TOKEN=... node scripts/setup-phase2.js
// Run from dental-template/ directory

const BASE  = process.env.DIRECTUS_URL
const TOKEN = process.env.DIRECTUS_TOKEN

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Ignore "already exists" errors (idempotent re-runs)
    const msg = JSON.stringify(json)
    if (msg.includes('already exists') || msg.includes('UNIQUE')) {
      console.log(`  ⚠ skipped (already exists): ${method} ${path}`)
      return json.data ?? null
    }
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`)
  }
  return json.data
}

// ── Helper: create a collection with a set of fields ──────────────────────
async function createCollection(name, fields, note = '') {
  await api('POST', '/collections', {
    collection: name,
    meta: { icon: 'view_agenda', note, hidden: false },
    schema: {},
  })
  console.log(`✓ collection: ${name}`)

  for (const f of fields) {
    await api('POST', `/fields/${name}`, { ...f, schema: f.schema ?? {} })
    console.log(`  ✓ field: ${f.field}`)
  }
}

// ── Owner relation helper (adds owner field + relation to directus_users) ──
async function addOwnerField(collection) {
  await api('POST', `/fields/${collection}`, {
    field: 'owner',
    type: 'uuid',
    meta: { interface: 'select-dropdown-m2o', special: ['m2o'], hidden: true },
    schema: {},
  })
  await api('POST', '/relations', {
    collection,
    field: 'owner',
    related_collection: 'directus_users',
  })
  console.log(`  ✓ owner field + relation`)
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK COLLECTIONS
// ═══════════════════════════════════════════════════════════════════════════

// block_hero — maps to Hero.astro props: { eyebrow, headline, description, cta_primary, cta_secondary, image_url }
await createCollection('block_hero', [
  { field: 'eyebrow',      type: 'string' },
  { field: 'headline',     type: 'string', meta: { required: true } },
  { field: 'description',  type: 'text' },
  { field: 'cta_primary',  type: 'string' },
  { field: 'cta_secondary',type: 'string' },
  { field: 'image_url',    type: 'string' },
], 'Hero section block')
await addOwnerField('block_hero')

// block_quote — maps to Quote.astro props: { text, author_name, author_role }
await createCollection('block_quote', [
  { field: 'text',        type: 'text',   meta: { required: true } },
  { field: 'author_name', type: 'string' },
  { field: 'author_role', type: 'string' },
], 'Pull quote block')
await addOwnerField('block_quote')

// block_features — maps to Features.astro props: { eyebrow, title, subtitle, image_url, items[] }
// items: [{ icon, title, desc }]  stored as JSON (repeater)
await createCollection('block_features', [
  { field: 'eyebrow',   type: 'string' },
  { field: 'title',     type: 'string' },
  { field: 'subtitle',  type: 'string' },
  { field: 'image_url', type: 'string' },
  { field: 'items',     type: 'json',   meta: { interface: 'list', note: 'Array of {icon, title, desc}' } },
], 'Feature highlights block')
await addOwnerField('block_features')

// block_services — maps to Services.astro props: { eyebrow, title, subtitle, items[] }
// items: [{ tag, title, desc, image_url, items[], cta }]
await createCollection('block_services', [
  { field: 'eyebrow',  type: 'string' },
  { field: 'title',    type: 'string' },
  { field: 'subtitle', type: 'string' },
  { field: 'items',    type: 'json', meta: { interface: 'list', note: 'Array of {tag, title, desc, image_url, items, cta}' } },
], 'Services listing block')
await addOwnerField('block_services')

// block_about — maps to About.astro which receives site.team: { eyebrow, title, subtitle, members[] }
// members: [{ name, role, bio, image_url }]
await createCollection('block_about', [
  { field: 'eyebrow',  type: 'string' },
  { field: 'title',    type: 'string' },
  { field: 'subtitle', type: 'string' },
  { field: 'members',  type: 'json', meta: { interface: 'list', note: 'Array of {name, role, bio, image_url}' } },
], 'Team / About block')
await addOwnerField('block_about')

// block_reviews — maps to Reviews.astro props: { title, subtitle, items[] }
// items: [{ name, stars, date, text }]
await createCollection('block_reviews', [
  { field: 'title',    type: 'string' },
  { field: 'subtitle', type: 'string' },
  { field: 'items',    type: 'json', meta: { interface: 'list', note: 'Array of {name, stars, date, text}' } },
], 'Patient reviews block')
await addOwnerField('block_reviews')

// block_opening_hours — maps to OpeningHours.astro props: { items[] }
// items: [{ day, time, open }]
await createCollection('block_opening_hours', [
  { field: 'items', type: 'json', meta: { interface: 'list', required: true, note: 'Array of {day, time, open}' } },
], 'Opening hours block')
await addOwnerField('block_opening_hours')

// block_vergoeding — maps to Vergoeding.astro props: { eyebrow, title, intro, blocks[], insurers[], cta }
await createCollection('block_vergoeding', [
  { field: 'eyebrow',   type: 'string' },
  { field: 'title',     type: 'string' },
  { field: 'intro',     type: 'text' },
  { field: 'blocks',    type: 'json', meta: { interface: 'list', note: 'Array of {title, text}' } },
  { field: 'insurers',  type: 'json', meta: { interface: 'tags', note: 'Array of insurer name strings' } },
  { field: 'cta',       type: 'string' },
], 'Insurance / reimbursement block')
await addOwnerField('block_vergoeding')

// block_contact — maps to Contact.astro props: { eyebrow, title, intro }
await createCollection('block_contact', [
  { field: 'eyebrow', type: 'string' },
  { field: 'title',   type: 'string' },
  { field: 'intro',   type: 'text' },
], 'Contact section block')
await addOwnerField('block_contact')

// block_footer — maps to Footer.astro footer prop: { tagline }
await createCollection('block_footer', [
  { field: 'tagline', type: 'string' },
], 'Footer block')
await addOwnerField('block_footer')

// block_text — free-form WYSIWYG (no corresponding existing Astro component)
await createCollection('block_text', [
  { field: 'content', type: 'text', meta: { interface: 'input-rich-text-html', required: true } },
], 'Free-form rich text block')
await addOwnerField('block_text')

// ═══════════════════════════════════════════════════════════════════════════
// PAGES COLLECTION
// ═══════════════════════════════════════════════════════════════════════════

await createCollection('pages', [
  { field: 'title',  type: 'string', meta: { required: true } },
  { field: 'slug',   type: 'string', schema: { is_unique: true }, meta: { required: true, note: 'URL path, e.g. over-ons. Use "home" for homepage.' } },
  {
    field: 'status',
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      options: { choices: [{ text: 'Published', value: 'published' }, { text: 'Draft', value: 'draft' }] },
      default_value: 'draft',
      required: true,
    }
  },
], 'Client pages')

// site relation: pages.site → site_configs
await api('POST', '/fields/pages', {
  field: 'site',
  type: 'uuid',
  meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true },
  schema: {},
})
await api('POST', '/relations', {
  collection: 'pages',
  field: 'site',
  related_collection: 'site_configs',
})
console.log('  ✓ site relation (pages → site_configs)')

console.log('\n✅ Phase 2 collections created.')
console.log('\nNEXT: Create the M2A "blocks" field on "pages" via Directus UI (see plan Task 2 Step 2).')
```

- [ ] **Step 2: Test collection creation before running the full script**

The `schema: {}` payload for `POST /collections` is consistent with Directus patterns but not explicitly documented. Before running the full batch, test against one collection:

```bash
curl -X POST https://autosite-cms.fly.dev/collections \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"collection":"poc_test","meta":{"icon":"box","hidden":false},"schema":{}}'
```

- If 200: `schema: {}` works — proceed with the script as written.
- If 400 with schema error: change `schema: {}` to `schema: null` everywhere in setup-phase2.js (replace `schema: {}` → `schema: null` in the createCollection call and the `POST /collections` body).
- Delete the test collection via Settings → Data Model before running the full script.

- [ ] **Step 3: Run the script**

```bash
cd dental-template
DIRECTUS_URL=https://autosite-cms.fly.dev \
DIRECTUS_TOKEN=<admin-token> \
node scripts/setup-phase2.js
```

Expected: all 11 block collections + pages collection created with no errors.

- [ ] **Step 3: Create the M2A "blocks" field via Directus UI**

The M2A alias field is most reliably created via the UI. The script cannot currently do this reliably in Directus v11 (same reason permissions were done via UI in Phase 1).

In Directus admin → Settings → Data Model → `pages` → Add Field:
1. Field type: **Many to Any**
2. Field key: `blocks`
3. Junction collection name: `page_section_blocks`
4. Allowed collections: select all 11 `block_*` collections
5. Sort field: `sort`
6. Save

Verify in Settings → Data Model:
- `pages` has a `blocks` field (M2A)
- `page_section_blocks` collection exists with fields: `id`, `page_id`, `sort`, `collection`, `item`

- [ ] **Step 4: Commit the setup script**

```bash
git add dental-template/scripts/setup-phase2.js
git commit -m "feat: add Phase 2 schema setup script (block collections + pages)"
```

---

## Task 3: Add Permissions for New Collections

**Files:** None (Directus UI)

The Client role needs permissions for `pages`, `page_section_blocks`, and all `block_*` collections.

- [ ] **Step 1: Add permissions for `pages`**

Settings → Access Control → Client policy → Add permissions:

| Action | Filter |
|---|---|
| read   | `{"site":{"owner":{"_eq":"$CURRENT_USER"}}}` |
| create | none (all) — owner will be set by client |
| update | `{"site":{"owner":{"_eq":"$CURRENT_USER"}}}` |
| delete | `{"site":{"owner":{"_eq":"$CURRENT_USER"}}}` |

Fields: `*` for all actions.

- [ ] **Step 2: Add `owner` field to `page_section_blocks` (pre-emptive workaround)**

Docs research confirms Directus v11 supports single and two-hop relational permission filters, but 3-hop depth (`page_id → site → owner`) is unreliable. Rather than testing it and fixing later, use the same `owner` field workaround that's proven to work for `block_*` collections.

In Directus admin → Settings → Data Model → `page_section_blocks` → Add Field:
- Field key: `owner`
- Interface: M2O → `directus_users`
- Hidden: true (admin-managed, not shown to clients)

Also add a Directus Flow (or handle in setup-phase2.js future extension) to auto-populate `owner` when a junction record is created. For now, the operator sets it manually when creating demo pages.

- [ ] **Step 3: Add permissions for `page_section_blocks`**

With the `owner` field in place, use a direct filter:

| Action | Filter |
|---|---|
| read   | `{"owner":{"_eq":"$CURRENT_USER"}}` |
| create | none |
| update | `{"owner":{"_eq":"$CURRENT_USER"}}` |
| delete | `{"owner":{"_eq":"$CURRENT_USER"}}` |

Fields: `*` for all actions.

- [ ] **Step 4: Add permissions for all block collections**

For each of the 11 `block_*` collections (block_hero, block_quote, block_features, block_services, block_about, block_reviews, block_opening_hours, block_vergoeding, block_contact, block_footer, block_text):

| Action | Filter |
|---|---|
| read   | `{"owner":{"_eq":"$CURRENT_USER"}}` |
| create | none |
| update | `{"owner":{"_eq":"$CURRENT_USER"}}` |
| delete | `{"owner":{"_eq":"$CURRENT_USER"}}` |

This uses the redundant `owner` field established in Task 2. Clients can only see/edit blocks they own.

- [ ] **Step 5: Verify permissions with demo client**

Log in as demo client (`peachsquad@proton...`). Verify:
- Can create a page (site should auto-filter to their site_config)
- Cannot see pages from other clients
- Can add blocks to their page
- Cannot see blocks from other clients

---

## Task 4: transformPages() — TDD

**Files:**
- Modify: `dental-template/scripts/content-transform.test.js`
- Modify: `dental-template/scripts/content-transform.js`

- [ ] **Step 1: Write the failing test**

Update the existing import line at the top of `dental-template/scripts/content-transform.test.js`. Change:
```javascript
import { applyBusinessFields, reconstructTheme } from './content-transform.js'
```
to:
```javascript
import { applyBusinessFields, reconstructTheme, transformPages } from './content-transform.js'
```

Then add the following test suite below the existing tests:

```javascript
// Simulated Directus pages API response (two pages, one with two blocks)
const rawPages = [
  {
    id: 'uuid-1',
    title: 'Over Ons',
    slug: 'over-ons',
    status: 'published',
    blocks: [
      {
        sort: 2,
        collection: 'block_quote',
        item: { id: 'uuid-q1', text: 'Great care.', author_name: 'Dr. A', author_role: 'Tandarts', owner: 'user-uuid' }
      },
      {
        sort: 1,
        collection: 'block_hero',
        item: { id: 'uuid-h1', headline: 'Over Ons', eyebrow: 'Team', description: 'Wij zijn...', owner: 'user-uuid' }
      },
    ]
  },
  {
    id: 'uuid-2',
    title: 'Diensten',
    slug: 'diensten',
    status: 'published',
    blocks: []
  },
]

describe('transformPages', () => {
  it('returns one entry per page', () => {
    const result = transformPages(rawPages)
    assert.equal(result.length, 2)
  })

  it('preserves slug, title, status', () => {
    const result = transformPages(rawPages)
    assert.equal(result[0].slug, 'over-ons')
    assert.equal(result[0].title, 'Over Ons')
    assert.equal(result[0].status, 'published')
  })

  it('sorts blocks by sort field ascending', () => {
    const result = transformPages(rawPages)
    const blocks = result[0].blocks
    assert.equal(blocks[0].collection, 'block_hero')   // sort: 1
    assert.equal(blocks[1].collection, 'block_quote')  // sort: 2
  })

  it('strips owner and id from block items', () => {
    const result = transformPages(rawPages)
    const heroItem = result[0].blocks[0].item
    assert.equal(heroItem.owner, undefined)
    assert.equal(heroItem.id, undefined)
    assert.equal(heroItem.headline, 'Over Ons')
  })

  it('handles page with no blocks', () => {
    const result = transformPages(rawPages)
    assert.deepEqual(result[1].blocks, [])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd dental-template
npm test
```

Expected: `SyntaxError` or `TypeError` — `transformPages` not exported.

- [ ] **Step 3: Implement transformPages in content-transform.js**

Add to `dental-template/scripts/content-transform.js`:

```javascript
/**
 * Transforms raw Directus pages API response into clean page objects for Astro.
 * Sorts blocks by `sort` field, strips internal fields (id, owner) from block items.
 *
 * @param {Array} pagesData - Array of page objects from Directus /items/pages response
 * @returns {Array} Clean page objects: [{ slug, title, status, blocks: [{ collection, item }] }]
 */
export function transformPages(pagesData) {
  return pagesData.map(page => ({
    slug: page.slug,
    title: page.title,
    status: page.status,
    blocks: (page.blocks || [])
      // Directus sets sort=null when blocks haven't been drag-reordered.
      // null ?? 0 makes all unsorted blocks equal; V8 (Node 20) stable sort
      // preserves insertion order in that case.
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map(b => ({
        collection: b.collection,
        item: stripInternalFields(b.item),
      })),
  }))
}

/**
 * Removes Directus-internal fields (id, owner) from a block item object.
 */
function stripInternalFields(item) {
  if (!item || typeof item !== 'object') return item
  const { id, owner, ...rest } = item
  return rest
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd dental-template
npm test
```

Expected: all tests pass (existing 8 + new 5 = 13 total).

- [ ] **Step 5: Commit**

```bash
git add dental-template/scripts/content-transform.js dental-template/scripts/content-transform.test.js
git commit -m "feat: add transformPages() with tests"
```

---

## Task 5: Extend fetch-content.js — Fetch Pages + Blocks

**Files:**
- Modify: `dental-template/scripts/fetch-content.js`

- [ ] **Step 1: Update fetch-content.js**

Replace the entire file with:

```javascript
/**
 * Fetches site content from Directus and writes:
 *   - src/data/site.json   (business fields overwritten from site_configs)
 *   - src/data/theme.json  (theme reconstructed from preset + accent colors)
 *   - src/data/pages/{slug}.json  (one file per published page)
 *
 * Usage: node scripts/fetch-content.js <client_id>
 * Env:   DIRECTUS_URL, DIRECTUS_TOKEN
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyBusinessFields, reconstructTheme, transformPages } from './content-transform.js'

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

async function get(path) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` }
  })
  if (!res.ok) {
    console.error(`Directus API error: ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  return (await res.json()).data
}

// ── 1. Fetch site_config ───────────────────────────────────────────────────
const configs = await get(
  `/items/site_configs?filter[client_id][_eq]=${encodeURIComponent(clientId)}&fields=*`
)
const config = configs?.[0]
if (!config) {
  console.error(`No site_config found for client_id: ${clientId}`)
  process.exit(1)
}

// ── 2. Fetch published pages with M2A blocks ───────────────────────────────
const BLOCK_COLLECTIONS = [
  'block_hero', 'block_quote', 'block_features', 'block_services',
  'block_about', 'block_reviews', 'block_opening_hours', 'block_vergoeding',
  'block_contact', 'block_footer', 'block_text',
]

// M2A requires explicit per-collection selectors — blocks.*.* does not work
const blockFields = BLOCK_COLLECTIONS.map(c => `blocks.item:${c}.*`).join(',')
const pagesFields = `id,title,slug,status,blocks.sort,blocks.collection,${blockFields}`

const rawPages = await get(
  `/items/pages?filter[site.client_id][_eq]=${encodeURIComponent(clientId)}&filter[status][_eq]=published&fields=${pagesFields}`
)

// ── 3. Load base site.json + theme presets ─────────────────────────────────
const dataDir   = resolve(__dirname, '../src/data')
const siteJson  = JSON.parse(readFileSync(resolve(dataDir, 'site.json'), 'utf8'))
const themesDir = resolve(dataDir, 'themes')
const presets   = Object.fromEntries(
  ['warm-editorial', 'ocean-depths', 'tech-innovation'].map(name => [
    name,
    JSON.parse(readFileSync(resolve(themesDir, `${name}.json`), 'utf8'))
  ])
)

// ── 4. Transform ───────────────────────────────────────────────────────────
const mergedSite  = applyBusinessFields(siteJson, config)
const mergedTheme = reconstructTheme(config, presets)
const pages       = transformPages(rawPages)

// ── 5. Write output files ──────────────────────────────────────────────────
writeFileSync(resolve(dataDir, 'site.json'),  JSON.stringify(mergedSite,  null, 2))
writeFileSync(resolve(dataDir, 'theme.json'), JSON.stringify(mergedTheme, null, 2))

const pagesDir = resolve(dataDir, 'pages')
mkdirSync(pagesDir, { recursive: true })

for (const page of pages) {
  writeFileSync(resolve(pagesDir, `${page.slug}.json`), JSON.stringify(page, null, 2))
  console.log(`  ✓ page: /${page.slug} (${page.blocks.length} blocks)`)
}

console.log(`\n✓ Content written for client: ${clientId}`)
console.log(`  business_name: ${config.business_name}`)
console.log(`  theme_preset:  ${config.theme_preset}`)
console.log(`  pages written: ${pages.length}`)
```

- [ ] **Step 2: Test locally against live Directus**

First, create a test page in Directus admin for `demo-tandarts`:
- Go to `pages` → Create item
- `site`: select `demo-tandarts`
- `title`: `Over Ons`
- `slug`: `over-ons`
- `status`: `published`
- `blocks`: Add a `block_hero` block with a headline

Then run:

```bash
cd dental-template
DIRECTUS_URL=https://autosite-cms.fly.dev \
DIRECTUS_TOKEN=<admin-token> \
node scripts/fetch-content.js demo-tandarts
```

Expected output:
```
  ✓ page: /over-ons (1 blocks)

✓ Content written for client: demo-tandarts
  business_name: Tandartspraktijk Demo
  theme_preset:  warm-editorial
  pages written: 1
```

Verify `dental-template/src/data/pages/over-ons.json` exists and contains `{ slug, title, status, blocks: [...] }` with hydrated block data (not just a UUID).

- [ ] **Step 3: Commit**

```bash
git add dental-template/scripts/fetch-content.js
git commit -m "feat: extend fetch-content to fetch pages + M2A blocks"
```

---

## Task 6: BlockRenderer.astro + [...slug].astro

**Files:**
- Create: `dental-template/src/components/BlockRenderer.astro`
- Create: `dental-template/src/pages/[...slug].astro`
- Create: `dental-template/src/data/pages/.gitkeep`

- [ ] **Step 1: Create src/data/pages/.gitkeep**

```bash
touch dental-template/src/data/pages/.gitkeep
```

Add to `dental-template/.gitignore` (or create if missing):
```
src/data/pages/*.json
```

- [ ] **Step 2: Create BlockRenderer.astro**

Create `dental-template/src/components/BlockRenderer.astro`:

```astro
---
/**
 * Renders the correct Astro component for a given block.
 * block.collection maps to the Directus block collection name.
 * block.item contains the block's field data (stripped of id/owner).
 * business is passed from site.json for components that need contact details.
 */
import Hero from './Hero.astro'
import Quote from './Quote.astro'
import Features from './Features.astro'
import Services from './Services.astro'
import About from './About.astro'
import Reviews from './Reviews.astro'
import OpeningHours from './OpeningHours.astro'
import Vergoeding from './Vergoeding.astro'
import Contact from './Contact.astro'
import Footer from './Footer.astro'

interface Props {
  collection: string
  item: Record<string, unknown>
  business: Record<string, unknown>
}

const { collection, item, business } = Astro.props
---

{collection === 'block_hero'          && <Hero data={item} business={business} />}
{collection === 'block_quote'         && <Quote data={item} />}
{collection === 'block_features'      && <Features data={item} />}
{collection === 'block_services'      && <Services data={item} />}
{collection === 'block_about'         && <About data={item} />}
{collection === 'block_reviews'       && <Reviews data={item} />}
{collection === 'block_opening_hours' && <OpeningHours data={item} business={business} />}
{collection === 'block_vergoeding'    && <Vergoeding data={item} />}
{collection === 'block_contact'       && <Contact data={item} business={business} />}
{collection === 'block_footer'        && <Footer business={business} footer={item} />}
{collection === 'block_text'          && <div class="block-text container section" set:html={item.content} />}
```

- [ ] **Step 3: Create [...slug].astro**

Create `dental-template/src/pages/[...slug].astro`:

```astro
---
/**
 * Dynamic routing for block-driven pages.
 * Reads all src/data/pages/*.json files at build time via import.meta.glob.
 * index.astro still handles the homepage (site.json, hardcoded order).
 * This file handles all other slugs (e.g. /over-ons, /diensten).
 *
 * If src/data/pages/ contains no files (no pages configured in Directus),
 * getStaticPaths returns [] and no extra pages are generated — that is correct.
 */
import site from '../data/site.json'
import Layout from '../layouts/Layout.astro'
import Nav from '../components/Nav.astro'
import BlockRenderer from '../components/BlockRenderer.astro'

export async function getStaticPaths() {
  // import.meta.glob returns {} when no files match — safe with no pages
  const modules = import.meta.glob('../data/pages/*.json', { eager: true })

  return Object.values(modules)
    .map((mod: any) => mod.default)
    // Exclude 'home' slug — the homepage is handled by index.astro (site.json).
    // Without this filter, a pages/home.json would generate a duplicate /home route.
    .filter(page => page.slug !== 'home')
    .map(page => ({
      params: { slug: page.slug },
      props:  { page },
    }))
}

interface Props {
  page: {
    slug: string
    title: string
    status: string
    blocks: Array<{ collection: string; item: Record<string, unknown> }>
  }
}

const { page } = Astro.props
---

<Layout title={`${page.title} – ${site.business.name}`}>
  <Nav business={site.business} />
  <main>
    {page.blocks.map(block => (
      <BlockRenderer
        collection={block.collection}
        item={block.item}
        business={site.business}
      />
    ))}
  </main>
</Layout>
```

- [ ] **Step 4: Build the template locally to verify no errors**

```bash
cd dental-template
npm run build
```

Expected: build succeeds. If `src/data/pages/` is empty, no additional pages are generated (that's correct). If `over-ons.json` exists (from Task 5 testing), `/over-ons/index.html` should appear in `dist/`.

- [ ] **Step 5: Verify the generated page in browser**

```bash
cd dental-template
npm run preview
```

Open `http://localhost:4321/over-ons` — should render the page with the hero block visible.

- [ ] **Step 6: Commit**

```bash
git add dental-template/src/components/BlockRenderer.astro \
        dental-template/src/pages/[...slug].astro \
        dental-template/src/data/pages/.gitkeep \
        dental-template/.gitignore
git commit -m "feat: add BlockRenderer + dynamic slug pages for block-driven routing"
```

---

## Task 7: End-to-End Validation

**Files:** None

This task validates the full client journey: create a page in Directus with blocks → click Deploy → see rendered page on Cloudflare Pages.

- [ ] **Step 1: Create a complete demo page with multiple blocks**

Log into Directus admin → `pages` → Create item:
- `site`: demo-tandarts
- `title`: Over Ons
- `slug`: over-ons
- `status`: published
- `blocks`: Add blocks in this order:
  1. `block_hero`: headline "Ons Team", eyebrow "Over Ons", description "Wij staan voor u klaar."
  2. `block_about`: eyebrow "Ons Team", title "Ervaren professionals", members: `[{"name":"Dr. A","role":"Tandarts","bio":"10 jaar ervaring","image_url":"https://picsum.photos/seed/dr-a/440/520"}]`
  3. `block_contact`: eyebrow "Contact", title "Neem contact op", intro "Bel of mail ons."

Drag to reorder if needed. Save.

- [ ] **Step 2: Trigger deploy via Deploy button**

On the `demo-tandarts` site_configs record → click **Deploy Site**.
Wait for GitHub Action to complete (check Actions tab in GitHub).

- [ ] **Step 3: Verify deployed page**

Open `https://demo-tandarts.pages.dev/over-ons`.

Expected:
- Page renders with Nav at top
- Hero section shows "Ons Team"
- About section shows team members
- Contact section shows "Neem contact op"
- No 404, no build errors

- [ ] **Step 4: Verify homepage is unchanged**

Open `https://demo-tandarts.pages.dev`.
Expected: homepage renders identically to before Phase 2 (driven by site.json, not blocks).

- [ ] **Step 5: Push to master and tag**

```bash
git push origin master
git tag phase2-complete
git push origin phase2-complete
```

---

## Known Limitations (carry to Phase 3 planning)

- Homepage (`index.astro`) is still hardcoded — clients cannot reorder homepage sections. Future work: migrate `index.astro` to use a pages-based `home` slug.
- Block `owner` field is not auto-populated on create — operator must set it manually when creating demo blocks. Future: Directus Flow on block create that sets `owner = current user`.
- No debounce on Deploy button — double-click triggers two runs (harmless).
- `block_text` renders raw HTML via `set:html` — no XSS risk since only admin/client can write it, but note for future.
- `block_footer` inside `[...slug].astro` renders inside `<main>`, while `index.astro` places `<Footer>` outside `<main>`. This may break CSS rules targeting the footer outside the content flow. Advise clients not to add `block_footer` to regular pages; it is intended for use in a future homepage block system.
- No "Add Page" UX guidance for clients — operator should provide a brief Directus tutorial for clients (future: Directus custom module or documentation page).
