# TinaCMS Multi-Tenancy — Technical Validation Plan

**Goal:** Validate whether a single self-hosted TinaCMS instance can serve multiple client sites, or whether a per-client deployment model is required.

**Why this needs validation:** TinaCMS self-hosted documentation does not address multi-tenancy. At small scale (< 10 clients), one TinaCMS deployment per client is manageable. At scale (50–100+ clients), per-client deployments become an ops burden. The right architecture needs to be confirmed before the CMS is built out.

---

## What needs to be validated

- [ ] Determine whether TinaCMS self-hosted can route multiple clients to separate Git repos from a single backend instance
- [ ] Determine whether the Auth.js user store supports client isolation (client A cannot access client B's site)
- [ ] Assess the ops cost of the per-client model at scale (deployment count, update propagation, monitoring)
- [ ] Assess feasibility and complexity of a shared multi-tenant instance
- [ ] Document the recommended model and its scaling ceiling
- [ ] Update the product requirements spec and CMS design with the validated approach
