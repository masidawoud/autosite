// One-time setup: creates site_configs schema + Client role in Directus
// Usage: DIRECTUS_URL=https://... DIRECTUS_TOKEN=... node scripts/setup-directus.js

const BASE = process.env.DIRECTUS_URL
const TOKEN = process.env.DIRECTUS_TOKEN

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

// 1. Create site_configs collection
await api('POST', '/collections', {
  collection: 'site_configs',
  meta: { icon: 'business', note: 'One record per client site' },
  schema: {},
})
console.log('✓ site_configs collection created')

// 2. Add fields
const fields = [
  { field: 'client_id',     type: 'string',  schema: { is_unique: true }, meta: { required: true, note: 'Cloudflare Pages project name' } },
  { field: 'business_name', type: 'string',  meta: { required: true } },
  { field: 'phone',         type: 'string',  meta: {} },
  { field: 'email',         type: 'string',  meta: {} },
  { field: 'address',       type: 'string',  meta: {} },
  { field: 'city',          type: 'string',  meta: {} },
  { field: 'postal_code',   type: 'string',  meta: {} },
  {
    field: 'theme_preset',
    type: 'string',
    meta: {
      interface: 'select-dropdown',
      options: {
        choices: [
          { text: 'Warm Editorial',  value: 'warm-editorial' },
          { text: 'Ocean Depths',    value: 'ocean-depths' },
          { text: 'Tech Innovation', value: 'tech-innovation' },
        ]
      }
    }
  },
  { field: 'theme_accent_1', type: 'string', meta: { interface: 'select-color' } },
  { field: 'theme_accent_2', type: 'string', meta: { interface: 'select-color' } },
]

for (const f of fields) {
  await api('POST', '/fields/site_configs', { ...f, schema: {} })
  console.log(`✓ field: ${f.field}`)
}

// 3. Create Client role
const role = await api('POST', '/roles', {
  name: 'Client',
  icon: 'person',
  description: 'Dental practice client — can only access their own site_config',
})
const roleId = role.id
console.log(`✓ Client role created (id: ${roleId})`)

// 4. Create owner relation: site_configs.owner → directus_users
await api('POST', '/fields/site_configs', {
  field: 'owner',
  type: 'uuid',
  schema: {},
  meta: { interface: 'select-dropdown-m2o', special: ['m2o'] },
})
await api('POST', '/relations', {
  collection: 'site_configs',
  field: 'owner',
  related_collection: 'directus_users',
})
console.log('✓ owner relation created')

// 5. Create a policy for the Client role (Directus v11 requires policy → role)
const policy = await api('POST', '/policies', {
  name: 'Client Policy',
  icon: 'person',
  description: 'Allows clients to read/update only their own site_config',
  admin_access: false,
  app_access: true,
})
const policyId = policy.id
console.log(`✓ Client policy created (id: ${policyId})`)

// 6. Link policy to role
await api('POST', '/access', {
  role: roleId,
  policy: policyId,
})
console.log('✓ Policy linked to Client role')

// 7. Set permissions on the policy
await api('POST', '/permissions', {
  policy: policyId,
  collection: 'site_configs',
  action: 'read',
  permissions: { owner: { _eq: '$CURRENT_USER' } },
  fields: '*',
})
await api('POST', '/permissions', {
  policy: policyId,
  collection: 'site_configs',
  action: 'update',
  permissions: { owner: { _eq: '$CURRENT_USER' } },
  fields: ['business_name','phone','email','address','city','postal_code','theme_preset','theme_accent_1','theme_accent_2'],
})
console.log('✓ Client role permissions set')

console.log('\n✅ Directus schema setup complete.')
console.log(`Client role ID: ${roleId}`)
console.log('Save this role ID — you need it when creating client users.')
