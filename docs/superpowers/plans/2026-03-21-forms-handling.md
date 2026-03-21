# Forms Handling — Validation Plan

**Goal:** Decide and validate how contact forms will work in a static Astro site hosted on Cloudflare Pages, given that the product requirements spec includes client-configurable form behaviour (recipients, fields, confirmation message).

**Why this needs validation:** Astro outputs static HTML — no server-side form processing. Cloudflare Pages does not support Netlify Forms or similar platform-native form handling. The form solution must integrate with the CMS setup so clients can configure it without touching code.

---

## What needs to be validated

- [ ] Evaluate options: Cloudflare Workers (custom endpoint, stays in CF ecosystem), or third-party service (Formspree, Formspark, EmailJS)
- [ ] Confirm chosen option supports client-configurable recipient email without a code deploy
- [ ] Confirm it works within the Node.js server + Cloudflare Pages architecture
- [ ] Confirm email deliverability to Dutch business inboxes (spam/SPF considerations)
- [ ] Document the chosen approach and update the product requirements spec accordingly
