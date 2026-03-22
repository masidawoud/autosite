# AutoSite — Contact Form Design

**Date:** 2026-03-22
**Type:** Feature spec
**Status:** Approved
**Stack:** Astro 4.x · Cloudflare Worker · Cloudflare KV · Cloudflare Turnstile · Resend EU · Self-hosted Gitea

---

## Overview

This spec defines the contact form backend for AutoSite dental client sites. The existing `Contact.astro` component has a fully-styled HTML form but no submission backend. This spec adds:

1. A shared Cloudflare Worker (`forms-worker`) that handles all client form submissions
2. Cloudflare KV for per-client form configuration (recipient email, confirmation message)
3. Resend EU (Frankfurt) for transactional email delivery
4. Cloudflare Turnstile for spam protection (server-side validation in the Worker)
5. Provisioning changes to `build-sites.js` and the client deploy workflow

**Scope:** Contact form only — no appointment booking, no submission log, no operator-side inbox.

---

## Architecture

```
Visitor submits form
  → Contact.astro (fetch POST + Turnstile token)
  → CF Worker: POST /submit/{project_name}
      → reject if body > 16 KB
      → validate Turnstile token (CF siteverify API)
      → read config from CF KV: form:{project_name}
      → send email via Resend EU → client's inbox
      → return { ok, message }
  → Contact.astro shows confirmation or error
```

### Components

| Component | Role |
|---|---|
| `Contact.astro` | Form UI, fetch POST, Turnstile widget, success/error display |
| CF Worker (`forms-worker`) | Single endpoint — `POST /submit/{project_name}` |
| CF KV | Per-client config: `{ recipient_email, confirmation_message }` |
| Cloudflare Turnstile | Bot protection — one site key for all clients, server-side validation |
| Resend EU (Frankfurt) | Transactional email delivery, `FROM noreply@autosite.nl` |

---

## Worker Project Layout

The Worker lives at `workers/forms-worker/` in the main `autosite` repo:

```
autosite/
  workers/
    forms-worker/
      src/
        index.js    ← Worker entry point (~50 lines)
      wrangler.toml
      package.json
```

Minimal `wrangler.toml`:

```toml
name = "forms-worker"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "FORM_CONFIG"
id = "<kv-namespace-id>"
```

Secrets set via `wrangler secret put`:
- `RESEND_API_KEY`
- `TURNSTILE_SECRET_KEY`

---

## Data Model

### Fields in `site.json` (client repo — committed)

```json
"project_name": "autosite-client-001",
"contact_form": {
  "recipient_email": "info@praktijk.nl",
  "confirmation_message": "Bedankt! Wij nemen binnen één werkdag contact op."
}
```

`recipient_email` and `confirmation_message` are client-editable via the CMS. `project_name` is operator-written at provisioning and not exposed in the CMS.

### Fields injected at build time (never committed to client repo)

Added to `site.json` by the `deploy.yml` workflow via `jq` before `astro build` runs:

```json
"contact_form": {
  "worker_url": "https://forms.autosite.nl/submit",
  "turnstile_site_key": "<operator-turnstile-site-key>"
}
```

Both are operator-infrastructure values shared across all clients, sourced from Gitea Actions variables `FORMS_WORKER_URL` and `TURNSTILE_SITE_KEY`.

### Template `site.json` stub

`dental-template/src/data/site.json` must include stub values so the dev server does not throw a prop error:

```json
"project_name": "dev",
"contact_form": {
  "recipient_email": "dev@example.com",
  "confirmation_message": "Bedankt voor uw bericht!",
  "worker_url": "http://localhost:8787/submit",
  "turnstile_site_key": "1x00000000000000000000AA"
}
```

(`1x00000000000000000000AA` is Cloudflare's public dummy site key for local development — Turnstile always passes with this key.)

### CF KV entry per client

Key: `form:{project_name}`
Value:
```json
{
  "recipient_email": "info@praktijk.nl",
  "confirmation_message": "Bedankt! Wij nemen binnen één werkdag contact op."
}
```

Written by `build-sites.js` at provisioning, and re-synced by the deploy workflow on every push (see Provisioning), both via the CF KV REST API directly — no Worker endpoint needed for config updates.

---

## CF Worker

One Worker deployment handles all clients. Single endpoint only.

### `POST /submit/{project_name}`

**Request validation:**
1. Reject if `Content-Length` > 16 KB — return `413`
2. Parse JSON body — return `400` if malformed
3. Validate `privacy === "true"` — return `400` if missing (GDPR consent required)
4. Validate `cf-turnstile-response` token via `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `TURNSTILE_SECRET_KEY` — return `400` if invalid

**Request body:**
```json
{
  "naam": "Jan",
  "achternaam": "de Vries",
  "email": "jan@example.com",
  "telefoon": "06 12 34 56 78",
  "bericht": "...",
  "privacy": "true",
  "cf-turnstile-response": "<token>"
}
```

**Processing:**
1. Read `form:{project_name}` from `FORM_CONFIG` KV — return `404` if not found
2. Send email via Resend EU:
   - `FROM`: `noreply@autosite.nl`
   - `TO`: `recipient_email` from KV
   - `Subject`: `Nieuw contactformulier — {project_name}`
   - `Body`: all submitted fields formatted as plain text
3. Return `200 { ok: true, message: confirmation_message }`

**Error response:** `500 { ok: false, message: "Er is iets misgegaan." }` for any unhandled failure.

### Worker secrets

| Secret | Set via |
|---|---|
| `RESEND_API_KEY` | `wrangler secret put RESEND_API_KEY` |
| `TURNSTILE_SECRET_KEY` | `wrangler secret put TURNSTILE_SECRET_KEY` |

No `OPERATOR_SECRET` needed — KV is updated directly via the CF REST API, not through a Worker endpoint.

---

## `Contact.astro` Changes

### New props

```astro
interface Props {
  data: { eyebrow: string; title: string; intro: string; };
  business: { phone: string; email: string; address: string; postal_code: string; city: string; };
  contactForm: {
    worker_url: string;
    turnstile_site_key: string;
    confirmation_message: string;
  };
  projectName: string;
}
```

`recipient_email` is intentionally not passed as a prop — it stays in KV server-side only.

### Turnstile widget

Add inside the form, above the submit button:

```html
<div class="cf-turnstile" data-sitekey={contactForm.turnstile_site_key}></div>
```

Add to `Layout.astro` (once, shared across all pages):

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

### Form submission handler (inline `<script>`)

- On submit: `preventDefault()`, set button to loading state (`disabled`, label "Verzenden…")
- Collect all field values + `privacy` checkbox value + `cf-turnstile-response` token
- `fetch POST` to `${contactForm.worker_url}/${projectName}` with JSON body
- On `ok: true`: hide form, show `<p class="contact__confirmation">{confirmation_message}</p>`
- On `ok: false` or network error: show `<p class="contact__error">Er is iets misgegaan. Probeer het opnieuw of neem telefonisch contact op.</p>`, re-enable submit button, reset Turnstile via `turnstile.reset()`

### `index.astro` — updated `SECTION_MAP` entry

The CMS spec's `SECTION_MAP` contact entry must pass `projectName`:

```astro
contact: () => <Contact
  data={site.contact}
  business={site.business}
  contactForm={site.contact_form}
  projectName={site.project_name}
/>,
```

---

## Provisioning Changes

### New `prospects.csv` column

`form_recipient_email` — if blank, defaults to the `email` column.

### New fields written to `site.json` by `build-sites.js`

- `project_name` — from the CF Pages project name (already tracked in `prospects.csv`)
- `contact_form.recipient_email` — from `form_recipient_email` column (or `email`)
- `contact_form.confirmation_message` — default Dutch string

### CF KV write at provisioning

After generating `site.json`, `build-sites.js` writes the KV entry:

```
PUT https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/{KV_NAMESPACE_ID}/values/form:{project_name}
Body: { "recipient_email": "...", "confirmation_message": "..." }
Auth: Bearer {CLOUDFLARE_API_TOKEN}
```

`KV_NAMESPACE_ID` added to `.env`.

### Deploy workflow additions

Three new steps added to `.gitea/workflows/deploy.yml`:

```yaml
- name: Inject operator config
  run: |
    jq --arg url "$FORMS_WORKER_URL" \
       --arg key "$TURNSTILE_SITE_KEY" \
      '.contact_form.worker_url = $url | .contact_form.turnstile_site_key = $key' \
      template/src/data/site.json > /tmp/site.json && \
      mv /tmp/site.json template/src/data/site.json
  env:
    FORMS_WORKER_URL: ${{ vars.FORMS_WORKER_URL }}
    TURNSTILE_SITE_KEY: ${{ vars.TURNSTILE_SITE_KEY }}

# ... (existing build + deploy steps) ...

- name: Sync form config to KV
  run: |
    RECIPIENT=$(jq -r '.contact_form.recipient_email' template/src/data/site.json)
    CONFIRMATION=$(jq -r '.contact_form.confirmation_message' template/src/data/site.json)
    PROJECT=$(jq -r '.project_name' template/src/data/site.json)
    curl -s -X PUT \
      "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/storage/kv/namespaces/$KV_NAMESPACE_ID/values/form:$PROJECT" \
      -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"recipient_email\":\"$RECIPIENT\",\"confirmation_message\":\"$CONFIRMATION\"}"
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    KV_NAMESPACE_ID: ${{ vars.KV_NAMESPACE_ID }}
```

This keeps KV in sync whenever a client updates their recipient email or confirmation message via the CMS — no custom Worker endpoint or shared secret needed.

---

## Operator One-Time Setup

1. **Resend:** create account, select EU (Frankfurt) region, verify `autosite.nl` sender domain, generate API key
2. **CF Turnstile:** create widget in Cloudflare dashboard, add `*.pages.dev` as allowed hostname (add custom client domains as they onboard), copy site key and secret key
3. **CF KV:** create namespace `form-config` in Cloudflare dashboard, copy namespace ID
4. **CF Worker:** deploy `forms-worker` via Wrangler from `workers/forms-worker/`, bind `FORM_CONFIG` KV namespace, set `RESEND_API_KEY` and `TURNSTILE_SECRET_KEY` via `wrangler secret put`
5. **Gitea Actions variables** (operator account level): `FORMS_WORKER_URL`, `TURNSTILE_SITE_KEY`, `KV_NAMESPACE_ID`
6. **`.env`:** add `KV_NAMESPACE_ID` for `build-sites.js`

---

## Open Questions

| Question | Impact | Resolution |
|---|---|---|
| Gitea org-level Actions variables | If supported, `FORMS_WORKER_URL`, `TURNSTILE_SITE_KEY`, `KV_NAMESPACE_ID` are set once and inherited by all client repos. If not, they must be set per repo at provisioning | Validate during implementation |
| Turnstile custom client domains | Clients with custom domains need their domain added to the Turnstile widget's allowed hostnames | Document as manual step during custom domain setup |
| Resend `FROM` domain branding | All emails arrive from `noreply@autosite.nl` in v1 | Acceptable for v1; revisit if clients request branded sender |
