// Run after setup-directus.js — adds policy + permissions for the Client role (Directus v11)
// Usage: DIRECTUS_URL=https://... DIRECTUS_TOKEN=... ROLE_ID=... node scripts/setup-permissions.js

const BASE   = process.env.DIRECTUS_URL
const TOKEN  = process.env.DIRECTUS_TOKEN
const roleId = process.env.ROLE_ID

if (!BASE || !TOKEN || !roleId) {
  console.error('Missing DIRECTUS_URL, DIRECTUS_TOKEN, or ROLE_ID')
  process.exit(1)
}

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

const policy = await api('POST', '/policies', {
  name: 'Client Policy',
  icon: 'person',
  description: 'Allows clients to read/update only their own site_config',
  admin_access: false,
  app_access: true,
})
console.log(`✓ Client policy created (id: ${policy.id})`)

await api('POST', '/access', {
  role: roleId,
  policy: policy.id,
})
console.log('✓ Policy linked to Client role')

await api('POST', '/permissions', {
  policy: policy.id,
  collection: 'site_configs',
  action: 'read',
  permissions: { owner: { _eq: '$CURRENT_USER' } },
  fields: '*',
})

await api('POST', '/permissions', {
  policy: policy.id,
  collection: 'site_configs',
  action: 'update',
  permissions: { owner: { _eq: '$CURRENT_USER' } },
  fields: ['business_name','phone','email','address','city','postal_code','theme_preset','theme_accent_1','theme_accent_2'],
})
console.log('✓ Client role permissions set')

console.log('\n✅ Permissions setup complete.')
console.log(`Policy ID: ${policy.id}`)
