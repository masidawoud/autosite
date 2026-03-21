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
// Use site_config.id (integer FK) to filter pages — avoids relational filter
// permission issues with filter[site.client_id] on some Directus deployments.
// blocks.item.* hydrates all block types; per-collection colon syntax is broken
// in Directus v11.16.1.
// blocks.item.* hydrates all M2A block types in Directus v11.
// The * must be percent-encoded (%2A) — Directus v11 strips unencoded wildcards
// in query strings when passed via programmatic fetch.
const pagesFields = 'id,title,slug,status,blocks.sort,blocks.collection,blocks.item.%2A'

const rawPages = await get(
  `/items/pages?filter[site][_eq]=${config.id}&filter[status][_eq]=published&fields=${pagesFields}`
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
