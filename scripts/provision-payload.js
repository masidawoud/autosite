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
  // The multi-tenant plugin adds a 'tenants' array field to Users.
  // Each entry is { tenant: <id>, roles: [...] } — check the plugin's field shape.
  const userRes = await fetch(`${PAYLOAD_API_URL}/api/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: values.email,
      password: values.password,
      role: 'user',
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
