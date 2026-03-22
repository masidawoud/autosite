# Form Services Research — AutoSite

**Date:** 2026-03-22
**Status:** Decision made — see Executive Summary

---

## Executive Summary

After two rounds of research, **CF Worker + Resend EU** was chosen for v1. All third-party services either lacked programmatic provisioning (required for `build-sites.js` automation at 100+ clients) or stored data outside the EU (a GDPR blocker for Dutch dental practice patient data). The CF-native approach avoids a new vendor dependency, fits the existing infrastructure, and defers the third-party decision until the business is validated.

---

## Round 1 — Non-EU Services Comparison

**Context:** Static Astro site on Cloudflare Pages, 100+ client sites at ~5–30 submissions/month each. Key metrics: reliable delivery, low cost, programmatic provisioning (no manual dashboard per client).

| Service | Free tier | Cost @2k/mo | Programmatic provisioning | Recipient per client | Plain HTML POST | Deal-breaker |
|---|---|---|---|---|---|---|
| **Basin** | 50/mo, 1 form | ~$355/yr (Growth+overage) | ✅ Full REST API | ✅ `notification_emails` in API | ✅ | Data in Canada/USA — GDPR blocker |
| **Web3Forms** | Unlimited (claimed) | Free | ❌ No API for key creation | ✅ Key tied to email | ✅ | No automation API |
| **Formspree** | 50/mo | ~$30/mo (Pro) | ❌ No confirmed form-creation API | ✅ Linked emails | ✅ | No confirmed provisioning API |
| **Formspark** | 250 total (one-time) | ~$25/workspace/yr | ❌ No management API | Dashboard only | ✅ | 100 workspaces = $2,500 one-time |
| **EmailJS** | 200/mo | $9/mo | ❌ Dashboard only | Fixed in template | ❌ JS required | Requires JS; exposes credentials in source |
| **Static Forms** | 500/mo | $9/mo (Pro) | ❌ No key creation API | Tied to account | ✅ | All submissions route to operator account |
| **FormSubmit** | Unlimited (claimed) | Free | ❌ No API; per-client click needed | Email in action URL | ✅ | Client must click verification email |
| **FormBold** | 100/mo, 5 forms | $16/mo (Business) | Unconfirmed | Multiple emails claimed | ✅ | API capabilities unverified |

**Best non-EU option: Basin** — only service with a full REST API for creating forms with per-form `notification_emails`. Eliminated due to Canada/USA data residency.

---

## Round 2 — EU Data Residency Research

Research agent was killed before completing (got caught on CF D1 jurisdiction edge case). Key finding before termination: no mainstream third-party form service with a programmatic provisioning API confirmed EU data residency. The CF Worker + Resend EU path was confirmed as the strongest option.

**Resend EU region:** Available (Frankfurt). GDPR DPA available. Pricing: free tier covers 3,000 emails/month (100 clients × 30 = comfortably within free). Paid from $20/month at higher volume.

**CF Worker + CF KV:** Cloudflare offers EU data residency for KV via jurisdiction flags. Workers are GDPR compliant. No new vendor dependency — we're already on CF Pages.

---

## Decision

**CF Worker + Resend EU (Frankfurt) for v1.**

Rationale:
- EU data residency confirmed on both components (Resend Frankfurt, CF KV with EU jurisdiction)
- No new vendor to evaluate, contract, or monitor
- Full programmatic control — `build-sites.js` creates/updates KV entries at provisioning
- Resend free tier (3,000 emails/month) covers the entire client base at low volume
- Spam protection can be added later (Turnstile or honeypot) at a single Worker update point

**Revisit third-party when:** business is validated, client count exceeds ~150, or operational complexity of managing the Worker becomes a concern.

---

## Future Evaluation Criteria (if revisiting third-party)

If re-evaluating third-party services, the non-negotiables are:
1. EU data residency confirmed, DPA available
2. Programmatic form creation via REST API with per-form recipient email
3. Plain HTML POST (no client-side JS required)
4. Pricing predictable at 100+ clients, low volume
