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
