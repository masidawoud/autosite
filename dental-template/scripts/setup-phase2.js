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
    const msg = JSON.stringify(json)
    if (msg.includes('already exists') || msg.includes('UNIQUE')) {
      console.log(`  ⚠ skipped (already exists): ${method} ${path}`)
      return json.data ?? null
    }
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`)
  }
  return json.data
}

// Owner field definition — included in every block collection
const OWNER_FIELD = {
  field: 'owner',
  type: 'uuid',
  meta: { interface: 'select-dropdown-m2o', special: ['m2o'], hidden: true },
  schema: {},
}

// ── Create collection with all fields in one API call (Directus v11) ───────
// Separate POST /fields calls return 403 on newly created collections.
// Including fields in the POST /collections payload works correctly.
async function createCollection(name, fields, note = '') {
  const allFields = [...fields, OWNER_FIELD].map(f => ({ ...f, schema: f.schema ?? {} }))

  await api('POST', '/collections', {
    collection: name,
    meta: { icon: 'view_agenda', note, hidden: false },
    schema: {},
    fields: allFields,
  })
  console.log(`✓ collection: ${name} (${allFields.length} fields)`)

  // Register the M2O relation for the owner field
  await api('POST', '/relations', {
    collection: name,
    field: 'owner',
    related_collection: 'directus_users',
  })
  console.log(`  ✓ owner → directus_users`)
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCK COLLECTIONS
// ═══════════════════════════════════════════════════════════════════════════

// block_hero — Hero.astro: { eyebrow, headline, description, cta_primary, cta_secondary, image_url }
await createCollection('block_hero', [
  { field: 'eyebrow',       type: 'string' },
  { field: 'headline',      type: 'string', meta: { required: true } },
  { field: 'description',   type: 'text' },
  { field: 'cta_primary',   type: 'string' },
  { field: 'cta_secondary', type: 'string' },
  { field: 'image_url',     type: 'string' },
], 'Hero section block')

// block_quote — Quote.astro: { text, author_name, author_role }
await createCollection('block_quote', [
  { field: 'text',        type: 'text',   meta: { required: true } },
  { field: 'author_name', type: 'string' },
  { field: 'author_role', type: 'string' },
], 'Pull quote block')

// block_features — Features.astro: { eyebrow, title, subtitle, image_url, items[] }
await createCollection('block_features', [
  { field: 'eyebrow',   type: 'string' },
  { field: 'title',     type: 'string' },
  { field: 'subtitle',  type: 'string' },
  { field: 'image_url', type: 'string' },
  { field: 'items',     type: 'json', meta: { interface: 'list', note: 'Array of {icon, title, desc}' } },
], 'Feature highlights block')

// block_services — Services.astro: { eyebrow, title, subtitle, items[] }
await createCollection('block_services', [
  { field: 'eyebrow',  type: 'string' },
  { field: 'title',    type: 'string' },
  { field: 'subtitle', type: 'string' },
  { field: 'items',    type: 'json', meta: { interface: 'list', note: 'Array of {tag, title, desc, image_url, items, cta}' } },
], 'Services listing block')

// block_about — About.astro: { eyebrow, title, subtitle, members[] }
await createCollection('block_about', [
  { field: 'eyebrow',  type: 'string' },
  { field: 'title',    type: 'string' },
  { field: 'subtitle', type: 'string' },
  { field: 'members',  type: 'json', meta: { interface: 'list', note: 'Array of {name, role, bio, image_url}' } },
], 'Team / About block')

// block_reviews — Reviews.astro: { title, subtitle, items[] }
await createCollection('block_reviews', [
  { field: 'title',    type: 'string' },
  { field: 'subtitle', type: 'string' },
  { field: 'items',    type: 'json', meta: { interface: 'list', note: 'Array of {name, stars, date, text}' } },
], 'Patient reviews block')

// block_opening_hours — OpeningHours.astro: { items[] }
await createCollection('block_opening_hours', [
  { field: 'items', type: 'json', meta: { interface: 'list', required: true, note: 'Array of {day, time, open}' } },
], 'Opening hours block')

// block_vergoeding — Vergoeding.astro: { eyebrow, title, intro, blocks[], insurers[], cta }
await createCollection('block_vergoeding', [
  { field: 'eyebrow',  type: 'string' },
  { field: 'title',    type: 'string' },
  { field: 'intro',    type: 'text' },
  { field: 'blocks',   type: 'json', meta: { interface: 'list', note: 'Array of {title, text}' } },
  { field: 'insurers', type: 'json', meta: { interface: 'tags', note: 'Array of insurer name strings' } },
  { field: 'cta',      type: 'string' },
], 'Insurance / reimbursement block')

// block_contact — Contact.astro: { eyebrow, title, intro }
await createCollection('block_contact', [
  { field: 'eyebrow', type: 'string' },
  { field: 'title',   type: 'string' },
  { field: 'intro',   type: 'text' },
], 'Contact section block')

// block_footer — Footer.astro: { tagline }
await createCollection('block_footer', [
  { field: 'tagline', type: 'string' },
], 'Footer block')

// block_text — free-form WYSIWYG
await createCollection('block_text', [
  { field: 'content', type: 'text', meta: { interface: 'input-rich-text-html', required: true } },
], 'Free-form rich text block')

// ═══════════════════════════════════════════════════════════════════════════
// PAGES COLLECTION
// ═══════════════════════════════════════════════════════════════════════════

await api('POST', '/collections', {
  collection: 'pages',
  meta: { icon: 'article', note: 'Client pages', hidden: false },
  schema: {},
  fields: [
    { field: 'title',  type: 'string', schema: {}, meta: { required: true } },
    { field: 'slug',   type: 'string', schema: { is_unique: true }, meta: { required: true, note: 'URL path e.g. over-ons. Use "home" for homepage.' } },
    {
      field: 'status',
      type: 'string',
      schema: {},
      meta: {
        interface: 'select-dropdown',
        options: { choices: [{ text: 'Published', value: 'published' }, { text: 'Draft', value: 'draft' }] },
        default_value: 'draft',
        required: true,
      },
    },
    {
      field: 'site',
      type: 'uuid',
      schema: {},
      meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true },
    },
  ],
})
console.log('✓ collection: pages')

await api('POST', '/relations', {
  collection: 'pages',
  field: 'site',
  related_collection: 'site_configs',
})
console.log('  ✓ site → site_configs')

console.log('\n✅ Phase 2 collections created.')
console.log('\nNEXT: Add the M2A "blocks" field on "pages" via Directus UI:')
console.log('  Settings → Data Model → pages → Create Field in Advanced Mode')
console.log('  Type: Many to Any | Key: blocks | Junction: page_section_blocks | Sort: sort')
console.log('  Allowed collections: all 11 block_* collections')
