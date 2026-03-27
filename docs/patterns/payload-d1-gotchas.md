# Payload CMS + Cloudflare D1 — Patterns & Gotchas

Recurring issues discovered during spike work. Check this before writing migrations or provisioning a new client site.

---

## 1. Block table naming: field name is NOT in the table name

**Pattern:** `{collection_slug}_blocks_{block_slug}`

**Wrong assumption:** If the blocks field is named `sections`, tables will be `dental_sites_sections_hero`.
**Reality:** Payload's D1 adapter ignores the field name. Tables are always `dental_sites_blocks_hero` regardless.

**Rule:** When writing migrations for a blocks field, always use `_blocks_` as the separator — never the field name.

```sql
-- Correct
dental_sites_blocks_hero
dental_sites_blocks_services

-- Wrong
dental_sites_sections_hero   ← field was named "sections", still wrong
dental_sites_content_hero    ← field was named "content", still wrong
```

**How to verify:** `wrangler tail --format=json` while triggering a Payload API request — the raw SQL query shows exactly what table names Payload expects.

---

## 2. Every top-level block table requires a `block_name` column

**What it is:** An optional internal label Payload stores per block instance.

**Rule:** Every top-level block table (not nested array tables) must include:
```sql
`block_name` text
```

Nested array tables (e.g. `dental_sites_blocks_services_items`) do NOT need it.

---

## 3. `role` field must have `saveToJWT: true` for multiTenantPlugin

**Context:** When using `@payloadcms/plugin-multi-tenant`, the `userHasAccessToAllTenants` callback runs against the JWT payload — not a fresh DB query.

**Rule:** Any field read inside `userHasAccessToAllTenants` must have `saveToJWT: true` in the Users collection.

```typescript
// Users.ts
{
  name: 'role',
  type: 'select',
  options: ['super-admin', 'user'],
  saveToJWT: true,   // ← required
}
```

Without this, the role is always `undefined` in the JWT, multiTenantPlugin sees no tenant assignment, and returns 403 on all collection requests.

**After changing this:** existing logged-in users must log out and back in to get a fresh JWT.

---

## 4. Payload TypeScript migrations cannot be applied with `wrangler d1 migrations apply`

**Rule:** `wrangler d1 migrations apply` only handles `.sql` files. Payload generates TypeScript migrations.

Always apply Payload migrations with:
```bash
NODE_ENV=production PAYLOAD_SECRET=ignore pnpm payload migrate
```

`wrangler.jsonc` still needs `"migrations_dir": "src/migrations"` so wrangler knows where to look for its own SQL migration tracking — but the actual TypeScript migrations go through the Payload CLI.

---

## 5. `wrangler pages deploy` defaults to a preview deployment

**Rule:** Always pass `--branch=main` (or whatever the production branch is) to target production:

```bash
npx wrangler@4 pages deploy dist --project-name=my-project --branch=main
```

Without `--branch`, every deploy goes to a hash-prefixed preview URL and never updates the production URL.

---

## 6. `workflow_dispatch` runs the workflow from the default branch

**Context:** When using `workflow_dispatch` to trigger GitHub Actions (e.g. from a Payload afterChange hook), GitHub always runs the workflow file from the repository's **default branch** — not the branch you're working on.

**Rule:** Any workflow change only takes effect after it's merged into the default branch (`master` or `main`). Testing workflow changes on a feature branch has no effect on dispatched runs.

---

## 7. Unnamed tabs keep fields flat at the DB/API root

**Pattern:** When using `type: 'tabs'` in Payload, omitting `name` on tab objects keeps all fields at the collection's root level in both the database and API response.

**Why it matters:** Adding named tabs wraps fields in a namespace (e.g. `site.bedrijfsgegevens.practiceName`). Unnamed tabs keep them flat (`site.practiceName`). Use unnamed tabs when you want UI organisation without changing the data shape.

```typescript
// Unnamed tab — fields stay flat
{
  type: 'tabs',
  tabs: [
    {
      label: 'Bedrijfsgegevens',  // no `name` property
      fields: [ { name: 'practiceName', ... } ]
    }
  ]
}
// API: site.practiceName ✓

// Named tab — fields are nested
{
  type: 'tabs',
  tabs: [
    {
      name: 'bedrijfsgegevens',
      label: 'Bedrijfsgegevens',
      fields: [ { name: 'practiceName', ... } ]
    }
  ]
}
// API: site.bedrijfsgegevens.practiceName
```
