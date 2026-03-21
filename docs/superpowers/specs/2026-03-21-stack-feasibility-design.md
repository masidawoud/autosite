# AutoSite Stack Feasibility — Astro + Cloudflare Pages + TinaCMS Self-Hosted

**Date:** 2026-03-21
**Type:** Feasibility analysis — reference when writing technical briefs for CMS and delivery pipeline
**Status:** Approved

---

## Stack Under Review

| Layer | Technology |
|---|---|
| Static site generator | Astro 4.x |
| Hosting | Cloudflare Pages |
| CMS backend | TinaCMS self-hosted (Node.js server instance) |
| CMS auth | Auth.js (`UsernamePasswordAuthJSProvider`) |
| User store | Cloudflare D1 or KV (TBD) |
| Content storage | Git (per-client GitHub repo) |

---

## 1. Custom Domain per Client

**Verdict: Fully achievable. One manual step per client.**

Cloudflare Pages exposes a REST API endpoint for adding custom domains to a Pages project (`POST /accounts/{id}/pages/projects/{name}/domains`). The existing `CLOUDFLARE_API_TOKEN` covers this — no new credentials needed. Wrangler CLI does not support this operation; a direct API call is required.

**Apex domains** (e.g. `tandarts-roovers.nl`) require the domain to be a Cloudflare DNS zone (nameservers pointed to Cloudflare). Once that is done, Cloudflare's CNAME flattening handles apex routing and everything is scriptable via API. DNS record creation is also API-driven (`POST /zones/{zone_id}/dns_records`).

**The one manual step:** during client onboarding, the client (or operator on their behalf) points their domain's nameservers to Cloudflare. This is a one-time action per client. After that, all domain setup — adding the domain to the Pages project, creating DNS records — is fully scripted.

This fits the product requirement of "zero to minimal manual intervention, some acceptable in the short term." Making nameserver transfer a standard onboarding step is the recommended path.

---

## 2. TinaCMS Auth — Email/Password, No GitHub for Clients

**Verdict: Fully achievable.**

TinaCMS self-hosted supports `UsernamePasswordAuthJSProvider` via Auth.js. Clients log in with email and password only. The CMS backend uses a GitHub Personal Access Token or GitHub App as a service account to commit content changes — clients never interact with GitHub.

Self-service password recovery is supported via Auth.js.

**Infrastructure requirement:** a database is needed to store user accounts. A lightweight store is sufficient — Cloudflare D1 (SQLite, stays within the CF ecosystem) or Cloudflare KV are both viable options. This is significantly lighter than the Postgres dependency that caused Directus to be parked.

---

## 3. TinaCMS Hosting

**Verdict: Compatible — runs on the Node.js server instance already in the design.**

TinaCMS self-hosted requires a Node.js runtime. It cannot run on Cloudflare Pages (edge-only, no Node.js). It runs on the Node.js server instance already planned in the architecture. The Astro site is served from Cloudflare Pages; the TinaCMS backend runs on the Node.js server. These are separate concerns and do not conflict.

---

## 4. Forms

**Verdict: Gap — needs technical validation before CMS design is finalised.**

Astro outputs static HTML. Cloudflare Pages has no native form handling. A form solution must be chosen and validated in the context of the Node.js server + Cloudflare Pages setup before the CMS form configuration feature is designed.

See: `docs/superpowers/plans/2026-03-21-forms-handling.md`

---

## 5. TinaCMS Multi-Tenancy

**Verdict: Unresolved — needs technical validation.**

TinaCMS self-hosted documentation does not address multi-tenancy. Per-client instances (one TinaCMS deployment per client) work at small scale but become an ops burden at 50–100+ clients. Whether a single shared instance can route multiple clients to separate Git repos, with proper auth isolation, is unconfirmed.

See: `docs/superpowers/plans/2026-03-21-tinacms-multitenancy.md`

---

## Summary

| Requirement | Status | Notes |
|---|---|---|
| Custom domain per client | ✅ Achievable | CF API fully scriptable; one-time DNS onboarding step per client |
| Email/password CMS auth | ✅ Achievable | Auth.js + lightweight DB (CF D1/KV) |
| TinaCMS on Node.js server | ✅ Compatible | Runs on planned server instance |
| Form handling | ⚠️ Validation needed | See forms plan |
| TinaCMS multi-tenancy at scale | ⚠️ Validation needed | See multi-tenancy plan |
