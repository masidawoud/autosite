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
