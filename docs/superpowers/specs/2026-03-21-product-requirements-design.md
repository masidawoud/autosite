# AutoSite — Product Requirements

**Date:** 2026-03-21
**Type:** Soft requirements — living reference for comparing against technical briefs
**Scope:** Full product lifecycle; dental/Dutch is the initial vertical, the platform is designed to be vertical-agnostic
**Status:** Approved

---

## Overview

AutoSite is a productised pipeline that generates and deploys production-ready websites for local small businesses. The initial vertical is Dutch dental practices; the platform is designed to support additional verticals over time. The operator runs the pipeline; clients receive a live site and a CMS to manage their content. Every stage from prospect discovery to live delivery should be scriptable and operable by a single person without a DevOps team.

A core platform constraint: no critical state should live only in local files. All pipeline state must be version-controlled or recoverable from source. This constraint applies to CMS and pipeline architecture choices equally.

---

## Stage 1 — Prospect Discovery

The operator sources prospects through bulk data exports (e.g. Apify scrapes of local business directories). Before entering the pipeline, each prospect passes an automated qualification step — no manual triage.

**Qualification filters out:**
- Businesses that are part of a larger organisation, franchise, or chain
- Businesses with a complex existing website (many custom-designed pages — not a simple brochure site)
- Businesses with more than 3 locations

These rules are specific to the dental vertical. As multi-vertical support is introduced, qualification rules are expected to vary per vertical and should be configurable rather than hardcoded.

**Qualification does not check** phone number, address, or business type — these are assumed present in the data source.

Prospects that pass qualification land in the pipeline's source of truth (currently `prospects.csv`) with status `pending`. The scraper also fetches the prospect's existing website — extracting current structure, copy, and branding signals — so content generation starts with real context.

**Operator visibility:** A structured status log per run. A minimal local dashboard (stack TBD) is the short-term target for operational monitoring.

---

## Stage 2 — Site Preview

A preview site is generated and deployed per prospect as a sales tool — the operator shares a live URL with the prospect before any commitment.

**Requirements:**
- Triggered manually by the operator in the initial phase
- Fully scriptable — a single command produces a deployable preview from prospect data
- Deployed to a staging subdomain (e.g. `preview-{id}.pages.dev`)
- The home page is fully built with real prospect data and fully visible
- All other pages are fully built but blurred out via CSS — visible as teasers, not placeholder skeletons. This means the preview pipeline generates complete multi-page content, not home-page-only content.
- The preview is the actual product built on real data, not a mockup

No manual steps between the operator triggering a preview run and a shareable URL being ready.

---

## Stage 3 — Onboarding & Delivery

When a prospect converts to a paying client, the handoff follows this sequence:

1. **Content build** — all pages are built and populated. Content is sourced from the prospect's existing site and improved with AI: copy is rewritten to be more engaging and patient-focused. Images are sourced from a default library (currently Unsplash/Picsum); the approach for client-specific imagery at scale is TBD.
2. **Dev CMS access** — the client is given access to a staging environment with CMS enabled (email + password, no GitHub required) to review and adjust their site before go-live. The staging environment is a separate deployment from the eventual production site; the mechanism for promoting staging → production is TBD.
3. **Client approval** — once the client is satisfied, the operator points the site to the client's live domain.

**Custom domain:**
- Each client serves their site from their own domain name
- The operator handles domain pointing; CDN and DNS setup details are TBD
- The goal is zero to minimal manual intervention per client at scale; some manual steps are acceptable in the short term

The content-review gate is operator-controlled — the operator marks a prospect as client-ready only after verifying that content is accurate and production-appropriate. This decision is never made automatically by the pipeline.

---

## Stage 4 — Client Content Management

> **Note:** The CMS solution is not yet chosen. Directus was evaluated and parked; TinaCMS self-hosted is under re-evaluation. Stage 4 describes requirements that any chosen CMS must satisfy — not a confirmed implementation.

Clients manage their site through a CMS accessible via email and password only. No GitHub account, no developer knowledge required. The CMS must not require any client-side technical setup.

The state constraint from the Overview applies here: CMS content must be version-controlled or recoverable from source — a CMS that stores content exclusively in a proprietary database without export/backup guarantees does not meet this requirement.

**Authentication:**
- Email + password login
- Self-service password recovery (automated, no operator intervention)

**Content controls — four levels:**

### Global
- Header: logo, navigation links
- Footer: contact details, social links, legal copy

### Page management
- Clients can create new pages
- Pages are assembled from a library of predefined section types (e.g. hero, services list, team, contact, FAQ)
- Sections within a page can be reordered via drag-and-drop
- The section library is operator-controlled; adding a new section type is an operator-side action only

### Section editing
- Each section's content (copy, images) is editable inline
- Clients cannot access or edit raw HTML, CSS, or the underlying template

### Forms
- Clients can configure the behaviour of contact forms: recipient email address(es), fields shown, confirmation message
- Available form types are defined by the operator

---

## Stage 5 — Platform Operations

### Automation
Every pipeline stage — qualification, preview generation, content build, delivery, domain handoff — must be executable as a CLI command. The operator should be able to run any stage without a UI. This is a hard requirement; no stage should require manual intervention that cannot in principle be scripted.

### Operator tooling
A minimal local dashboard (stack TBD) is the short-term target for pipeline visibility — showing prospect status, deployed URLs, health, and client readiness. This replaces the current terminal-only workflow.

### Multi-vertical support
The platform is designed to support multiple business verticals beyond dental (e.g. physiotherapy, beauty, legal). The intent is that vertical-specific concerns — copy tone, qualification rules, section library, template structure — should be driven by configuration rather than requiring code changes. This is a medium-term requirement; the initial build is dental-only.

### Template propagation
When the operator updates a template component, that update must be deployable to all live client sites in a single operation. Client content is untouched — only the template layer updates.

### Operational constraints
- The system must be operable by a single person without a DevOps team
- Infrastructure choices should minimise ongoing ops burden (self-hosted databases, manual schema management, and similar are to be avoided)
- All pipeline state is version-controlled or recoverable from source (no critical state in local-only files)
