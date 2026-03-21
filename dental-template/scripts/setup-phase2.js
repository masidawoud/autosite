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
