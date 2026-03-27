# Post-Spike Review: Spike 1-2 — Payload CMS Blocks Page-Builder

**Date:** 2026-03-27
**Branch:** spike/payload-cms
**Goal:** Add Payload CMS Blocks page-builder + Tabs to DentalSites for a proper client-facing editing experience, and verify the full E2E flow from CMS save → GitHub Actions → live site.

---

## What We Built

- 9 Payload block types (`HeroBlock`, `QuoteBlock`, `FeaturesBlock`, `ServicesBlock`, `TeamBlock`, `ReviewsBlock`, `HoursBlock`, `VergoedingBlock`, `ContactBlock`) in `payload-cms/src/blocks/`
- Reorganised `DentalSites` collection into 4 unnamed tabs (Pagina-inhoud, Bedrijfsgegevens, Thema, SEO & Footer)
- `sections` blocks field on the Pagina-inhoud tab (minRows: 0, maxRows: 20)
- D1 migrations to create the blocks tables
- GitHub Actions workflow updated with blocks-first path + legacy fallback
- `afterChange` hook dispatching GitHub Actions builds on every CMS save

---

## Issues Encountered

### 1. Wrong D1 block table names

**What happened:** The initial migration created tables named `dental_sites_sections_hero`, `dental_sites_sections_quote`, etc. Payload returned a 500 on every DentalSites API request.

**Root cause:** We assumed the table name would include the field name (`sections`). Payload's D1 adapter ignores the field name entirely and uses a fixed `_blocks_` keyword: `{collection}_blocks_{blockSlug}`.

**How we diagnosed it:** Ran `wrangler tail --format=json` while triggering an API request in the admin. The raw SQL query in the logs showed Payload looking for `dental_sites_blocks_hero` — not `dental_sites_sections_hero`.

**Fix:** Wrote a corrective migration (`20260327_200000_fix_blocks_table_names.ts`) that created the correctly-named tables and dropped the wrong ones. Applied via Payload CLI (`NODE_ENV=production PAYLOAD_SECRET=ignore pnpm payload migrate`).

---

### 2. Missing `block_name` column

**What happened:** After fixing the table names, Payload still errored when saving a record with blocks.

**Root cause:** Each top-level block table requires a `block_name text` column — Payload uses it as an optional internal label for block instances. The initial migration omitted it.

**Fix:** Added `block_name text` to every top-level block table in the corrective migration.

---

### 3. User role not in JWT — multiTenantPlugin returning 403

**What happened:** After fixing the DB, the DentalSites collection appeared empty in the admin for `masidawoud.g@gmail.com`. API returned `{ errors: [{ message: 'Something went wrong.' }] }`.

**Root cause:** The `role` field on the Users collection was missing `saveToJWT: true`. The multiTenantPlugin's `userHasAccessToAllTenants` check reads `user.role` from the JWT — without it, the role was always undefined, the plugin saw no tenant assignment, and returned 403.

Additionally, the user's `role` in the database was `'user'` instead of `'super-admin'`.

**Fix:**
1. Added `saveToJWT: true` to the `role` field in `Users.ts`
2. Updated the user's role directly: `UPDATE users SET role = 'super-admin' WHERE email = 'masidawoud.g@gmail.com'` via `wrangler d1 execute D1 --remote`
3. Logged out and back in to get a fresh JWT with the updated role

---

### 4. `wrangler d1 migrations apply` not finding Payload migrations

**What happened:** Running `wrangler d1 migrations apply --remote` failed silently or looked in the wrong directory.

**Root cause:** Two issues:
- Wrangler defaulted to `migrations/` but our migrations live in `src/migrations/`
- Wrangler's migration system only handles `.sql` files — Payload uses TypeScript migrations

**Fix:**
- Added `"migrations_dir": "src/migrations"` to `wrangler.jsonc`
- Used Payload CLI for applying migrations: `NODE_ENV=production PAYLOAD_SECRET=ignore pnpm payload migrate`

---

### 5. GitHub Actions deploying to preview URL instead of production

**What happened:** Every CMS save triggered a build that deployed to a hash-prefixed preview URL (`5784d29d.dentist-lie-dental.pages.dev`) with alias `master.dentist-lie-dental.pages.dev` — not the production URL.

**Root cause:** `wrangler pages deploy` without `--branch` defaults to a preview deployment. Passing `--branch=main` targets the production branch.

**Secondary issue:** The fix was committed to `spike/payload-cms`, but `workflow_dispatch` always runs the workflow from the repository's **default branch** (`master`). So the fix had no effect until the spike was merged into master.

**Fix:**
1. Added `--branch=main` to the deploy command in the workflow
2. Merged `spike/payload-cms` → `master` so the workflow on the default branch picked up the change

---

## What Went Well

- `wrangler tail` was invaluable for diagnosing the SQL table name mismatch — raw query in the logs made it unambiguous
- The blocks-first + legacy fallback pattern in the workflow means existing flat-field sites continue to work while new sites use blocks
- Unnamed tabs kept all existing field paths flat at the DB/API root — no migration needed for existing data

---

## Time Lost

| Issue | Approx. time lost |
|---|---|
| Wrong block table names | ~45 min |
| Missing `block_name` column | ~15 min |
| User role / JWT issue | ~30 min |
| Wrangler migration confusion | ~20 min |
| Preview vs production deploy | ~20 min |

---

## What to Watch For on Future Client Sites

See `docs/patterns/payload-d1-gotchas.md`.
