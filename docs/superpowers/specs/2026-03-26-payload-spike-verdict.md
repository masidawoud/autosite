# Payload CMS Spike Verdict
_Date: 2026-03-26_

## Success criteria

| Criterion | Result | Notes |
|---|---|---|
| Payload admin loads at Workers URL with email+password login | ✅ PASS | `https://autosite-payload-cms.peachsquad.workers.dev/admin` |
| Two test tenants isolated (each sees only their content) | ✅ PASS | Multi-tenant plugin confirmed working via API |
| Operator super-admin sees all tenants | ✅ PASS | `userHasAccessToAllTenants` confirmed |
| Provisioning script creates new client in <5 minutes | ✅ PASS | ~5 seconds end-to-end |
| GitHub Actions build fetches content from Payload, builds Astro, deploys | ✅ PASS | Lie Dental deployed to `https://master.dentist-lie-dental.pages.dev` |
| trigger-payload-rebuilds.js dispatches all builds in parallel | ✅ PASS | Script tested, dispatches via GitHub API |
| Monthly cost under €30 | ✅ PASS | Workers paid plan $5/mo + D1 free tier = ~€5-10/mo at 100 clients |

**All 6 criteria: PASS**

## Blockers encountered (and resolved)

1. **Wrong D1 adapter** — Previous spike used `@payloadcms/db-sqlite` (local SQLite). Correct package is `@payloadcms/db-d1-sqlite` with `sqliteD1Adapter({ binding: cloudflare.env.D1 })`. Fixed in this spike.

2. **Wrong multi-tenant plugin API** — Plan spec had incorrect option names (`userIsAdmin`, `tenantsArrayFieldName`). Real API is `userHasAccessToAllTenants` and `tenantsArrayField.arrayFieldName`. Discovered by reading installed package types.

3. **Stale import map** — Adding the multi-tenant plugin requires regenerating the Payload admin import map (`npx payload generate:importmap`). Without this the admin page renders blank. Fixed and redeployed.

4. **Migration conflict** — Old template migration (`20250929_111647`) was already applied to D1 from an earlier attempt. New migration written as a delta. Resolved.

5. **Workflow not visible in GitHub Actions UI** — `workflow_dispatch` workflows only appear in the UI when they exist on the default branch. Copied workflow to `master` for testing.

## Recommendation

**✅ PROCEED — migrate from Sveltia + Gitea to Payload before 50 clients**

### Reasons

- **Better UX:** Native email+password login with no OAuth popup. Clients log in directly at `cms.foove.nl/admin` with no Gitea branding.
- **Drag-and-drop:** Payload's admin UI has native drag-and-drop for array fields/sections. No waiting for Sveltia v2.0.
- **Simpler provisioning:** One script, ~5 seconds, no Gitea repo creation, no act runner jobs, no SSH key management.
- **Better template propagation:** GitHub Actions runs all client builds in parallel (no queue saturation). Self-hosted Gitea act runner serialises jobs.
- **Lower ops burden:** No VPS to maintain, no act runner to babysit, no SMTP to configure. Cloudflare Workers is fully managed.
- **Cost:** ~€5-10/month at 100 clients vs ~€8-15/month for the Gitea VPS (similar cost, much lower ops overhead).

### What full migration requires (Phase 1)

- Extend `DentalSites` schema to full 15+ field content model (all current YAML fields)
- Add `personality` field to Tenants (which Astro variant to render)
- Update `build-from-payload.yml` to map all fields → `site.json` + `theme.json` + `sections.json`
- Update `provision-payload.js` to replace the current Gitea 7-step provisioning
- Add webhook trigger from Payload on content save (instead of manual workflow dispatch)
- Set `PAYLOAD_SECRET` properly via `wrangler secret put`
- Custom domain: `cms.foove.nl` pointing to the Workers URL
- Backup strategy for D1 (Cloudflare point-in-time recovery on paid plan)
