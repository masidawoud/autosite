# Forms — Design Spec

**Date:** 2026-03-21
**Type:** Feature spec
**Status:** Directionally confirmed — validation required before implementation

---

## Overview

Contact forms on client sites are handled by a single shared Cloudflare Worker. Clients configure form behaviour (recipients, fields, confirmation message) in the CMS — no code deploy required for changes to take effect.

> **Dependency:** This spec assumes TinaCMS self-hosted is adopted as the CMS. If the CMS decision changes, the config flow will need to be revisited.

---

## Architecture

| Component | Role |
|---|---|
| Cloudflare Worker | Shared form submission endpoint, routed by project name |
| Cloudflare KV | Stores per-client form config |
| Resend | Transactional email delivery |
| Cloudflare Turnstile | Spam protection |
| TinaCMS | Client-facing form configuration UI |

**Submission flow:**
1. Visitor submits form → `POST /submit/{project-name}` to the Worker
2. Worker validates Turnstile token (reject if invalid)
3. Worker reads form config from KV (`form:{project-name}`)
4. Worker sends email to configured recipient(s) via Resend
5. Worker returns the configured confirmation message to the visitor

**Config flow:**
- On client onboarding, the pipeline writes the initial form config to KV from `site.json`
- When the client updates form settings in the CMS, the TinaCMS backend updates KV via the Cloudflare API

**Astro integration:**
- The form component reads `project-name` from `site.json` at build time and constructs the Worker URL. `project-name` maps to the client's Cloudflare Pages project name — the same identifier used throughout the pipeline.
- **Open decision:** whether form fields are fixed at build time (simplest — requires a site rebuild to change fields) or fetched dynamically from a Worker `GET /config/{project-name}` endpoint on page load (no rebuild needed, but adds a client-side JS dependency). This must be resolved during implementation.

---

## Client-configurable fields

- Recipient email address(es)
- Which fields are shown (e.g. name, email, phone, message)
- Confirmation message displayed after submission

---

## Scope

- Contact forms only — no appointment booking, no submission log
- Email notification to the practice only — no operator-side inbox

---

## Needs validation

The overall approach (Worker + KV + Resend + Turnstile) is directionally confirmed. The following must be validated before implementation:

- **Field rendering model:** build-time static fields vs. client-side dynamic fetch — pick one (see Astro integration above)
- **TinaCMS → KV integration:** the TinaCMS backend writing to Cloudflare KV on content save is not standard behaviour — requires a custom server-side hook or webhook; this needs a spike
- **Resend sender domain model:** all emails from a single operator-owned domain (e.g. `noreply@autosite.nl`) vs. a verified sending domain per client — has product and ops implications
- **Turnstile site key model:** Turnstile site keys are bound to specific domains; with many client domains, clarify whether one key per client domain is required or if Cloudflare supports a shared/wildcard registration
- **Resend deliverability for Dutch inboxes:** SPF/DKIM setup, spam classification
- **CMS schema and UI for form config:** how the client configures recipient email and fields inside TinaCMS is not yet designed
