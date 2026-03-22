# AutoSite QA & Security Risk Analysis

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map all risk areas across the AutoSite stack, identify what kind of tests are needed per area, and surface best-practice patterns for each technology — without prescribing solutions.

**Architecture:** AutoSite has three distinct trust boundaries: (1) the operator pipeline (`build-sites.js`) that runs locally with full credentials, (2) the CI/CD layer (Gitea Actions on a Hetzner VPS) that runs per-client deploys, and (3) the client-facing layer (Sveltia CMS + Cloudflare Pages). Risks exist in all three, with the most severe concentrated at the pipeline and CI/CD layers where secrets live.

**Tech Stack:** Node.js (ESM), Astro 4.x, Gitea 1.25 (self-hosted Docker), Gitea Actions (act_runner), Cloudflare Pages (Wrangler CLI), Sveltia CMS, Groq API (llama-3.3-70b-versatile), SQLite (Gitea internal DB), Cloudflare Tunnel

---

## How to Read This Document

Each task covers one risk area. For each area the document records:
- **What it is** — the component and its role
- **Risk inventory** — concrete attack vectors and failure modes, ranked by severity
- **Test types needed** — what category of tests would catch each risk
- **Best practice patterns** — references to established patterns in this specific stack

Severity ratings:
- 🔴 **Critical** — data breach, secret exfiltration, arbitrary code execution
- 🟠 **High** — service disruption, credential theft, data corruption
- 🟡 **Medium** — information leakage, degraded reliability, compliance gap
- 🟢 **Low** — cosmetic errors, minor UX failures

---

## Task 1: Pipeline Script Risk (`build-sites.js`)

**Files:**
- Analyse: `build-sites.js` (548 lines, Node.js ESM)
- Reference: `package.json` (root), `.env`

- [ ] **Step 1: Map CSV injection risks**

  `build-sites.js` parses `prospects.csv` with a hand-rolled parser (lines 25–50). No schema enforcement. Risks:

  | Risk | Severity | Vector |
  |---|---|---|
  | Directory traversal via `id` field | 🔴 Critical | `id` value used directly as `builds/{id}/` — value `../../etc/passwd` would write outside builds/ |
  | CSV formula injection | 🟠 High | If CSV ever opened in Excel/Numbers (CLAUDE.md warns against this), values like `=CMD()` execute in spreadsheet context |
  | Groq prompt injection via `services`/`scraped_text` | 🟠 High | These fields are inserted verbatim into the LLM prompt — attacker with CSV write access could exfiltrate or manipulate output |
  | Invalid hex color crashing build | 🟡 Medium | `brand_color_1`/`brand_color_2` checked only for `startsWith('#')` — malformed hex (e.g. `#GGGGGG`) causes incorrect CSS |
  | Concurrent CSV writes causing corruption | 🟡 Medium | Two pipeline runs writing back to the same CSV simultaneously — no file lock |

  **Test types needed:**
  - Unit: CSV parser with adversarial inputs (path separator chars in id, formula strings, overlong values)
  - Unit: `buildTheme()` with invalid hex inputs
  - Integration: Two concurrent pipeline runs on the same CSV

  **Best practice patterns — Node.js pipeline scripts:**
  - Validate all CSV fields against a schema before processing (zod or joi)
  - Sanitise `id` with an allowlist regex (e.g. `/^[0-9]+$/`) before using as a filesystem path
  - Use a proper CSV library (csv-parse) rather than a hand-rolled parser
  - File locking for shared state files: `proper-lockfile` npm package
  - LLM prompt injection: separate system instructions from user data with explicit role tags; use `content` arrays instead of interpolated strings where the SDK allows

- [ ] **Step 2: Map subprocess execution risks**

  `build-sites.js` executes shell commands via `execSync`:
  - `npx wrangler pages project create {projectName}` (line 387)
  - `npx wrangler pages deploy dist/ --project-name={projectName}` (line 397)
  - `rsync -a --exclude node_modules ...` (line 135)
  - `npm run build` (line 513)

  | Risk | Severity | Vector |
  |---|---|---|
  | Command injection via `projectName` | 🔴 Critical | `slugify()` output fed into shell command string — if slugify can produce shell metacharacters, arbitrary commands execute |
  | Secrets visible in process list | 🟠 High | `CLOUDFLARE_API_TOKEN` passed via subprocess env — visible in `ps aux` output on multi-user systems |
  | Wrangler version pinning | 🟡 Medium | `npx wrangler@3` fetches latest 3.x — breaking changes in minor versions can silently break deploys |
  | Build artifacts retained in `builds/` | 🟡 Medium | Generated `site.json` contains PII (business contact data) in plaintext on operator machine |

  **Test types needed:**
  - Unit: `slugify()` against shell metacharacter inputs (`;`, `&&`, `|`, `$`, backtick, `..`)
  - Integration: Wrangler subprocess invocation with a mock project (verify env passthrough, no secret logging)

  **Best practice patterns — Node.js subprocess security:**
  - Use `execFile()` or `spawn()` with argument arrays instead of `exec()`/`execSync()` with string interpolation — argument arrays bypass shell interpretation entirely
  - Pin CLI tool versions exactly in package.json rather than using `npx @version`
  - Clean up `builds/{id}/` after deploy; don't retain generated PII on disk

- [ ] **Step 3: Map credential and secrets risks**

  | Secret | Stored In | Risk |
  |---|---|---|
  | `GROQ_API_KEY` | `.env` (local), loaded at runtime | 🟠 High: leaked = unlimited LLM spend; no rate limit in code |
  | `CLOUDFLARE_API_TOKEN` | `.env` (local), Gitea repo secrets | 🔴 Critical: token has write access to ALL Cloudflare Pages projects under the account |
  | `CLOUDFLARE_ACCOUNT_ID` | `.env` (local), Gitea repo secrets | 🟡 Medium: non-secret alone, but combined with token = full access |

  | Risk | Severity | Vector |
  |---|---|---|
  | `.env` accidentally committed | 🔴 Critical | `.gitignore` entry can be accidentally removed or bypassed with `git add -f` |
  | Token scope too broad | 🔴 Critical | A single Cloudflare token with Pages:Edit on all projects — compromise affects every deployed site |
  | No API spend cap on Groq | 🟠 High | Groq API has no rate limit in code; runaway loop or stolen key = unlimited billed requests |
  | Secrets in Gitea Actions logs | 🟠 High | If a workflow step `echo`s a secret or Wrangler logs it, it's visible in the Actions UI |

  **Test types needed:**
  - Static: `git-secrets` or `trufflehog` scan of repository history for committed secrets
  - Config audit: Cloudflare token scope — verify it's scoped to specific Pages projects, not account-wide
  - Config audit: Groq API key — verify spend alert is configured in Groq dashboard

  **Best practice patterns — Node.js secrets:**
  - Use `dotenv-vault` or AWS Secrets Manager instead of `.env` files for production pipelines
  - Cloudflare API tokens: create per-project tokens scoped to a single Pages project instead of account-wide tokens
  - Add Groq API budget alerts at 50% and 100% of monthly expected spend
  - Pre-commit hook: `git-secrets --scan` to block any commit containing AWS/API key patterns

---

## Task 2: PII and Data Handling Risks

**Files:**
- Analyse: `prospects.csv`, `build-sites.js` (lines 440–460, Groq prompt), `builds/*/src/data/site.json`

- [ ] **Step 1: Map PII exposure risks**

  `prospects.csv` contains: business name, city, phone, email, address, postal code for 30 dental practices. It is **version-controlled** (not gitignored).

  | Risk | Severity | Vector |
  |---|---|---|
  | Client PII in Git history | 🔴 Critical | Anyone with read access to the repo can see all client contact data in `git log` forever |
  | Groq API receives raw PII | 🟠 High | Business name, address, phone, email sent to Groq (US-based SaaS) — potential GDPR implications for Dutch clients |
  | Generated `site.json` retains PII on disk | 🟡 Medium | `builds/{id}/src/data/site.json` persists business contact details on operator machine after deploy |
  | Contact form has no backend | 🟡 Medium | `Contact.astro` renders a form with no `action` attribute — form submissions go nowhere; clients' patients cannot actually reach the practice via the form |

  **Test types needed:**
  - Static: Check `git log` for PII patterns (email regex, Dutch phone format `+316..`, postal code `[0-9]{4}[A-Z]{2}`)
  - Integration: Verify contact form submission is handled (currently has no action — this is a functional gap)
  - Compliance audit: Verify Groq's data processing agreement covers GDPR Article 28 (processor) for EU client data

  **Best practice patterns — PII in pipelines:**
  - Store client data in a database with row-level encryption, not in CSV files in version control
  - Pseudonymise data before sending to third-party APIs: send `client_{id}` instead of real business name to Groq where possible
  - GDPR: Maintain a Data Processing Register (Article 30) documenting Groq as a subprocessor
  - Add `.gitignore` entry for `prospects.csv` and migrate existing history with `git-filter-repo`

---

## Task 3: Astro Template Risks

**Files:**
- Analyse: `dental-template/src/layouts/Layout.astro`, `dental-template/src/pages/index.astro`, all components in `dental-template/src/components/`
- Analyse: `dental-template/src/data/site.json`, `dental-template/src/data/theme.json`

- [ ] **Step 1: Map template injection and XSS risks**

  Astro auto-escapes `{variable}` bindings in templates, preventing most XSS. However:

  `set:html` is **already used in two live files** — this is not a hypothetical risk:
  - `Layout.astro` line 46: `<Fragment set:html={\`<style>:root{${cssVars}}</style>\`} />` — CSS vars from `theme.json` injected directly into a `<style>` block via `set:html`
  - `Features.astro` line 53: `<div class="feature-item__icon" set:html={icons[f.icon] ?? icons.shield} />` — SVG icon strings injected; currently safe because `icons` is hardcoded, but becomes XSS if `icons` ever maps to user-controlled strings

  | Risk | Severity | Vector |
  |---|---|---|
  | `set:html` in Layout.astro (CSS injection) | 🟠 High | `theme.json` color values inserted into `<style>` block via `set:html` — a malformed color breaks or hijacks CSS; attacker with CMS access can inject `</style><script>...` |
  | `set:html` in Features.astro (SVG injection) | 🟡 Medium | Currently safe (hardcoded icon map) — becomes High if icon map is ever user-controlled |
  | Font URL injection in Layout.astro | 🟠 High | `theme.fonts.display_url` and `body_url` inserted into a Google Fonts `<link href>` tag (line 11) — malicious URL loads fonts from attacker domain; exfiltrates page context |
  | Image URL injection | 🟡 Medium | `hero.image_url`, `team.members[].image_url` passed directly to `<img src>` — if CMS allows editing these, could exfiltrate credentials via cross-origin image loads |
  | `tel:` and `mailto:` link injection | 🟡 Medium | `business.phone` used in `href="tel:{phone}"` and `business.email` in `href="mailto:{email}"` — malformed values could produce invalid links or `javascript:` URIs |

  **Test types needed:**
  - Static: Grep all `.astro` files for `set:html` usage — two instances already exist (Layout.astro:46, Features.astro:53)
  - Unit: Test Layout.astro with adversarial `theme.json` values (CSS-breaking color values, `</style><script>` injection)
  - Unit: Test each component with `<script>alert(1)</script>` in all string fields — verify Astro escapes it
  - Unit: Verify `tel:` and `mailto:` links are valid URI formats

  **Best practice patterns — Astro security:**
  - Astro docs: `set:html` bypasses escaping — only use with hardcoded or server-validated content, never with CMS-editable strings
  - For the CSS vars case in Layout.astro: validate each color value against `/^#[0-9A-Fa-f]{6}$/` before interpolation rather than using `set:html`
  - Add a Content Security Policy (CSP) header: restrict `font-src` to `fonts.googleapis.com fonts.gstatic.com`; restrict `img-src` to trusted domains (images.unsplash.com, picsum.photos, your CDN)
  - Validate `theme.json` against a JSON schema before rendering — reject unknown keys and invalid URL formats
  - Cloudflare Pages supports `_headers` file for custom HTTP headers (CSP, X-Frame-Options, HSTS)

- [ ] **Step 2: Map build-time data flow risks**

  | Risk | Severity | Vector |
  |---|---|---|
  | No schema validation on `site.json` | 🟠 High | If CMS or Groq returns malformed JSON (missing required field), Astro build fails silently or renders broken HTML |
  | Groq output trusted without sanitisation | 🟠 High | Groq-generated reviews, team bios, and service descriptions inserted into HTML — LLM jailbreak could produce script tags that Astro would escape, but logic bombs (e.g. SEO spam content) would be rendered |
  | `stars` field in reviews | 🟢 Low | Assumed 1–5 integer; no validation — invalid value (e.g. negative, string) would render broken star rating |

  **Test types needed:**
  - Unit: Build with site.json missing required fields — verify graceful fallback, not crash
  - Unit: Build with site.json containing all fields as empty strings — verify no broken HTML
  - Integration: End-to-end build with Groq output containing Unicode edge cases (RTL text, emoji, long strings)

  **Best practice patterns — Static site data validation:**
  - Use Zod or JSON Schema to validate `site.json` and `theme.json` before passing to Astro build
  - Astro: Define typed interfaces for all component props (already done partially); add runtime assertions in dev mode

---

## Task 4: Gitea Actions CI/CD Risks

**Files:**
- Analyse: `/tmp/client-selfhosted/.gitea/workflows/deploy.yml`
- Analyse: Gitea self-hosted runner configuration (docker-compose.yml at `/opt/gitea/`)

- [ ] **Step 1: Map workflow and supply chain risks**

  | Risk | Severity | Vector |
  |---|---|---|
  | `actions/checkout@v4` from github.com | 🟠 High | Workflow fetches action from GitHub at runtime — if GitHub is unavailable or action is compromised (e.g. typosquatted), workflow fails or executes malicious code |
  | Unpinned action version (`@v4` not a SHA) | 🟠 High | `v4` is a mutable tag — maintainer or attacker with write access to the action repo can push malicious code under the same tag |
  | `OPERATOR_TOKEN` embedded in git clone URL | 🔴 Critical | `deploy.yml` line 10: `git clone http://foovepages:${{ secrets.OPERATOR_TOKEN }}@<ip>/...` — git prints the full remote URL (including credentials) to stdout on clone; this is guaranteed log exposure in Gitea Actions run history, visible to anyone with repo read access |
  | Wrangler deployment from runner | 🟠 High | Runner container has access to `CLOUDFLARE_API_TOKEN` — if runner is compromised, attacker can deploy arbitrary content to all Pages projects |
  | `npm ci` with no lockfile integrity check | 🟡 Medium | `npm ci` uses `package-lock.json` — if lockfile is tampered in the repo, malicious packages install silently |
  | Runner mounts `/var/run/docker.sock` | 🔴 Critical | The act_runner container has the Docker socket mounted — any workflow with `docker run` access can escape to the host and access all other containers (including Gitea + its SQLite DB) |

  **Test types needed:**
  - Static: Audit deploy.yml for hardcoded secrets, `echo` of secret values, `set -x` that would print credentials
  - Security: Verify runner container cannot reach Gitea's data directory via Docker socket escape
  - Config audit: Verify `actions/checkout` is pinned to a full SHA, not a mutable tag
  - Config audit: Verify Cloudflare token used in runner is scoped to a single Pages project

  **Best practice patterns — Gitea Actions / GitHub Actions security:**
  - Pin all external actions to full commit SHAs: `uses: https://github.com/actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (SHA for v4)
  - Use `GITHUB_TOKEN` / Gitea `GITEA_TOKEN` with minimal permissions (contents: read, pages: write only)
  - Do not mount `/var/run/docker.sock` in the runner unless Docker-in-Docker is strictly required — for act_runner, disable container-based job execution via the runner's `config.yaml` `container.options` field rather than mounting the socket
  - Separate Cloudflare tokens per client: each client repo gets a token scoped to its own Pages project only
  - Use `git clone --depth 1` (already done) — avoid full history clone which increases attack surface
  - Gitea Actions docs: Set `GITEA__actions__ENABLED=true` only on repositories that need it; disable on template repo

- [ ] **Step 2: Map runner isolation risks**

  The act_runner runs in Docker on the same VPS as Gitea. All client repos share the same runner.

  | Risk | Severity | Vector |
  |---|---|---|
  | No job isolation between clients | 🟠 High | If two client repos' jobs run concurrently, one job's temp files or env vars could be visible to the other if runner doesn't fully clean between jobs |
  | Docker socket escape enables cross-client secret exfiltration | 🔴 Critical | Runner has `/var/run/docker.sock` — a malicious workflow step can run `docker exec gitea-gitea-1 sqlite3 /data/gitea/gitea.db` and read ALL client repo secrets from Gitea's DB; not just own secrets but every other client's `CLOUDFLARE_API_TOKEN` too |
  | Runner token single-use but stored | 🟡 Medium | Registration token used to register runner — if runner container logs it, token exposed (though single-use tokens are less risky post-registration) |
  | VPS access = full Gitea access | 🔴 Critical | Anyone with SSH access to the VPS can access Gitea's SQLite DB directly via `docker exec` — equivalent to full admin access to all client repos |

  **Test types needed:**
  - Security: Attempt to read another client's repo secrets from within a workflow run
  - Security: Attempt Docker socket escape from within a workflow step
  - Config audit: Verify runner user is not root inside the container

  **Best practice patterns — CI/CD runner security:**
  - Use ephemeral runners (destroy and recreate per job) to eliminate cross-job contamination
  - Do not mount Docker socket — use Kaniko or Podman for container builds if needed
  - Separate runner VPS from Gitea VPS for production — the runner must not have local network access to Gitea's data directory
  - Gitea Actions: Configure `GITEA__actions__DEFAULT_ACTIONS_URL` to a self-hosted mirror of common actions rather than fetching from github.com

---

## Task 5: Gitea Self-Hosted Server Risks

**Files:**
- Analyse: `/opt/gitea/docker-compose.yml` (on VPS)
- Analyse: Gitea SQLite DB (via `docker exec gitea-gitea-1 sqlite3 /data/gitea/gitea.db`)

- [ ] **Step 1: Map authentication and OAuth risks**

  | Risk | Severity | Vector |
  |---|---|---|
  | OAuth app `uid=0` grants admin-level OAuth trust | 🟠 High | Setting `uid=0` makes the OAuth app system-wide — in Gitea's auth model, `uid=0` apps carry admin-level trust for OAuth scope checks; every user who completes the OAuth flow receives a token that Gitea treats with elevated authority, not client-level scope. The consent screen is skipped precisely because Gitea treats it as a trusted admin app. |
  | `uid=0` bypass breaks on Gitea upgrade | 🟠 High | Applied by direct SQLite write — not an officially documented API; Gitea DB migrations on upgrade may reset or invalidate the bypass |
  | Gitea admin password in plain text in `.env` / scripts | 🔴 Critical | `GITEA_PASS="Peach159357!"` stored in `/tmp/run.sh` (temp file on operator machine) and in setup scripts — if these are committed or leaked, full admin access is compromised |
  | No 2FA on operator Gitea account | 🟠 High | `foovepages` admin account uses password only — no TOTP or WebAuthn configured |
  | Client repo secrets visible to runner | 🟠 High | Gitea Actions secrets are accessible to all workflow steps in a job — a compromised step could exfiltrate all secrets |
  | Gitea API token (`OPERATOR_TOKEN`) scoped too broadly | 🟠 High | Token has `write:repository`, `write:user`, `write:admin` — compromise = full Gitea admin equivalent |
  | HTTP-only Gitea access (no HTTPS internally) | 🟡 Medium | Gitea is on HTTP internally; Cloudflare Tunnel handles HTTPS externally — but local admin access (direct IP) is unencrypted |
  | Gitea running as root in container | 🟡 Medium | Default Gitea Docker image runs as root — container breakout = root on host |

  **Test types needed:**
  - Security: Verify 2FA is enforced for admin accounts
  - Security: Test token scope — verify `OPERATOR_TOKEN` cannot perform operations beyond what's needed (create repos, set secrets, add collaborators)
  - Config audit: Verify Gitea container runs as non-root user
  - Regression: After any Gitea upgrade, verify `uid=0` OAuth apps still skip consent screen

  **Best practice patterns — Gitea hardening:**
  - Enable 2FA requirement for all admin accounts: `app.ini` → `[security] REQUIRE_SIGNIN_VIEW = true`, enforce via Gitea admin panel
  - Create narrowly-scoped API tokens: separate tokens for repo management vs. user management vs. secrets management
  - Run Gitea container as non-root: add `user: "1000:1000"` to docker-compose service definition
  - Gitea docs: Use `[oauth2]` section in `app.ini` to control token expiry and rotation
  - Backup Gitea SQLite DB daily: `docker exec gitea-gitea-1 sqlite3 /data/gitea/gitea.db ".backup /data/backup/gitea-$(date +%Y%m%d).db"`
  - Document the `uid=0` workaround as a post-upgrade verification check

- [ ] **Step 2: Map CORS and network exposure risks**

  Gitea's CORS is configured with `ALLOW_DOMAIN=*` (wildcard):

  | Risk | Severity | Vector |
  |---|---|---|
  | CORS wildcard with credentials | 🟠 High | `ALLOW_DOMAIN=*` combined with `ALLOW_CREDENTIALS=true` — browsers reject this combination per the CORS spec, so the CSRF-via-CORS attack is blocked in practice. However the misconfiguration signals poor hygiene and non-browser clients (curl, mobile apps) are not protected. Should be tightened to explicit origin allowlist. |
  | Cloudflare Tunnel permanently exposes Gitea admin UI | 🟠 High | The Cloudflare Tunnel routes all traffic from a public HTTPS URL directly to Gitea — including the admin panel, API, and login page. Anyone who discovers the tunnel URL can attempt brute-force attacks on admin credentials. For a named production tunnel the URL is stable and predictable. |
  | Gitea port 80 directly accessible | 🟡 Medium | Port 80 is open on the VPS — Gitea admin UI also reachable via bare IP (bypasses Cloudflare Tunnel's HTTPS); credentials sent in plaintext on direct IP access |
  | VPS SSH access from any IP | 🟡 Medium | Port 22 open to all IPs — no IP allowlisting on SSH |
  | Cloudflare Tunnel URL changes on restart | 🟡 Medium | `fair-cliff-bluetooth-period.trycloudflare.com` — temporary trial URL; OAuth redirect URIs must be updated on each restart; named tunnel required for production |

  **Test types needed:**
  - Security: Verify CORS headers returned by Gitea API on cross-origin request from a non-Pages domain
  - Config audit: Replace `ALLOW_DOMAIN=*` with explicit allowlist of `*.pages.dev` and the production tunnel domain
  - Penetration: Test CSRF via CORS against Gitea API endpoints (attempt state-changing request from a third-party domain)

  **Best practice patterns — CORS hardening:**
  - Never use `ALLOW_DOMAIN=*` with `ALLOW_CREDENTIALS=true` — browsers block it and the combination is insecure
  - Allowlist exact origins: `GITEA__cors__ALLOW_DOMAIN=https://autosite-selfhosted.pages.dev,https://your-production-domain.com`
  - Restrict SSH access: add Hetzner firewall rule to allow port 22 only from operator's IP range
  - Use a named Cloudflare Tunnel (not trycloudflare.com) for production — stable URL, no restarts, mTLS between tunnel and origin

---

## Task 6: Cloudflare Pages Deployment Risks

**Files:**
- Analyse: `build-sites.js` (lines 380–410, deployment logic)
- Analyse: `dental-template/.gitea/workflows/deploy.yml`

- [ ] **Step 1: Map deployment security risks**

  | Risk | Severity | Vector |
  |---|---|---|
  | Single Cloudflare token for all projects | 🔴 Critical | One `CLOUDFLARE_API_TOKEN` with Pages:Edit on all projects — leaked token = attacker can overwrite all 30+ dental sites with malicious content |
  | No deployment signing or integrity check | 🟠 High | Wrangler uploads `dist/` contents without any content hash verification — MITM between Wrangler and Cloudflare could replace content |
  | `--commit-dirty` flag suppresses warnings | 🟡 Medium | `wrangler pages deploy --commit-dirty` used in `build-sites.js` (line 397, local pipeline only) — silences warnings about uncommitted changes; masks cases where wrong build artifacts are deployed. Note: `deploy.yml` (Gitea Actions path) does not use this flag. |
  | No rollback mechanism | 🟡 Medium | If a deploy produces broken HTML (e.g. Groq returned malformed JSON), there is no automated rollback — manual intervention required |
  | Project names derived from business names | 🟡 Medium | `tandarts-{slugifiedName}` — name collisions possible if two practices have identical names after slugification |

  **Test types needed:**
  - Config audit: Verify each Gitea repo secret `CLOUDFLARE_API_TOKEN` is scoped to its own Pages project
  - Integration: Test deploy with intentionally malformed `site.json` — verify failure detection before deploy
  - Integration: Test `slugify()` against duplicate business names — verify collision handling

  **Best practice patterns — Cloudflare Pages deployment:**
  - Create per-project Cloudflare API tokens scoped to a single Pages project: `Token → Edit Cloudflare Pages → Specific project`
  - Enable Cloudflare Pages deploy notifications (Slack/email) to detect unexpected deploys
  - Use Cloudflare Pages deployment rollback via API: `POST /client/v4/accounts/{id}/pages/projects/{name}/deployments/{id}/rollback`
  - Verify build output before deploy: check that `dist/index.html` exists and is > N bytes before running Wrangler

---

## Task 7: Sveltia CMS Client-Facing Risks

**Files:**
- Analyse: `dental-template/public/admin/index.html`
- Analyse: `/tmp/client-selfhosted/admin/config.yml`

- [ ] **Step 1: Map CMS authentication and authorisation risks**

  | Risk | Severity | Vector |
  |---|---|---|
  | Sveltia loaded from CDN (no version pin) | 🟠 High | `@sveltia/cms` on jsDelivr — `npm` package tag `latest` resolves to latest version; breaking changes or supply chain compromise affects all clients on next page load |
  | Client can edit any file in their repo | 🟡 Medium | `config.yml` defines which files are editable — if `config.yml` is not carefully scoped, client could edit `deploy.yml` (their workflow) and introduce malicious build steps |
  | Client repo `deploy.yml` editable via CMS | 🔴 Critical | If CMS `media_folder` or collections inadvertently allow writing to `.gitea/workflows/`, a client could modify their deployment workflow and execute arbitrary commands on the runner |
  | No rate limiting on Gitea login | 🟠 High | Gitea's default config has no brute-force protection on the login endpoint — dictionary attacks on client passwords are possible |
  | Weak password policy | 🟡 Medium | Client passwords set by operator during provisioning — no complexity enforcement visible in setup flow |
  | OAuth token stored in browser | 🟡 Medium | Sveltia stores the OAuth access token in `localStorage` — if XSS occurs on the Pages site, token is exfiltrated |

  **Test types needed:**
  - Security: Verify Sveltia `config.yml` does not allow writing to `.gitea/` directory
  - Security: Attempt to commit a malicious `deploy.yml` via the CMS — verify it is blocked by config scope
  - Config audit: Verify Gitea has `fail2ban` or equivalent brute-force protection on port 80
  - Security: Verify Sveltia's OAuth token is not accessible from the main site's JS context (separate origin)

  **Best practice patterns — Headless CMS security:**
  - Pin Sveltia CMS to a specific version: `@sveltia/cms@0.x.y` instead of latest; update deliberately
  - Explicitly scope `config.yml` collections to only the files that should be editable (`site.json`, `theme.json`, `sections.json`) — exclude `.gitea/`, `admin/`, and `public/`
  - Enable Gitea's built-in rate limiting: `app.ini` → `[security] LOGIN_REMEMBER_DAYS = 7`, `MAX_CREATION_LIMIT = 10`
  - Use `fail2ban` on the VPS watching Gitea's access log for repeated 401s
  - Subresource Integrity (SRI): add `integrity` hash to the Sveltia `<script>` tag in `index.html` so browsers reject tampered CDN assets

---

## Task 8: Dependency and Supply Chain Risks

**Files:**
- Analyse: `package.json` (root), `dental-template/package.json`

- [ ] **Step 1: Map dependency risks**

  | Dependency | Version | Risk |
  |---|---|---|
  | `groq-sdk` | `^0.9.0` | 🟡 Medium: caret allows minor/patch updates — breaking API changes or supply chain attack via npm |
  | `astro` | `^4.15.0` | 🟡 Medium: same caret risk; Astro is complex and has had CVEs in past versions |
  | `@sveltia/cms` | latest (CDN) | 🟠 High: no version pin on CDN load — see Task 7 |
  | `gitea/act_runner:latest` | latest | 🟠 High: Docker `latest` tag — breaking changes or compromised image update silently breaks all CI |
  | `gitea/gitea:1.25` | minor-pinned | 🟡 Medium: pinned to minor version — patch updates pulled automatically on container restart |
  | `actions/checkout@v4` | mutable tag | 🟠 High: see Task 4 |

  **Test types needed:**
  - Static: `npm audit` on both `package.json` files — check for known CVEs
  - Static: `npx better-npm-audit` or Snyk scan
  - Config audit: Pin all Docker images to specific digest SHAs in docker-compose.yml

  **Best practice patterns — supply chain security:**
  - Lock npm dependencies with exact versions (`npm install --save-exact`) and commit `package-lock.json`
  - Use `npm audit --audit-level=high` in CI to fail builds on high/critical CVEs
  - Pin Docker images to immutable digest SHAs: `gitea/gitea@sha256:abc123...`
  - Enable Dependabot (GitHub) or Gitea's equivalent for automated dependency update PRs
  - SRI hashes for all CDN-loaded scripts (Sveltia, any fonts loaded by JavaScript)

---

## Trial Complete — Risk Summary

- [ ] **Compile risk register**

  After completing all tasks above, compile a risk register with:

  | ID | Area | Risk | Severity | Test Type | Status |
  |---|---|---|---|---|---|
  | R01 | Pipeline | Directory traversal via `id` field | 🔴 Critical | Unit | Not tested |
  | R02 | Pipeline | Prompt injection via `scraped_text` | 🟠 High | Unit | Not tested |
  | R03 | Pipeline | Command injection via `projectName` | 🔴 Critical | Unit | Not tested |
  | R04 | Pipeline | `.env` accidental commit | 🔴 Critical | Static scan | Not tested |
  | R05 | Pipeline | Overly broad Cloudflare token | 🔴 Critical | Config audit | Not tested |
  | R06 | PII | `prospects.csv` in Git history | 🔴 Critical | Static scan | Not tested |
  | R07 | PII | GDPR: Groq as unregistered subprocessor | 🟠 High | Compliance audit | Not tested |
  | R08 | PII | Contact form has no backend (functional gap) | 🟡 Medium | Integration | Not tested |
  | R09 | Astro | Font URL injection in theme.json | 🟠 High | Unit | Not tested |
  | R10 | Astro | CSS injection via `set:html` in Layout.astro:46 | 🟠 High | Unit | Not tested |
  | R11 | Astro | SVG injection via `set:html` in Features.astro:53 | 🟡 Medium | Unit | Not tested |
  | R12 | Astro | No CSP headers on deployed sites | 🟠 High | Config audit | Not tested |
  | R13 | CI/CD | `OPERATOR_TOKEN` in git clone URL — guaranteed log exposure | 🔴 Critical | Static audit | Not tested |
  | R14 | CI/CD | `actions/checkout` mutable tag | 🟠 High | Config audit | Not tested |
  | R15 | CI/CD | Docker socket escape → cross-client secret exfiltration | 🔴 Critical | Security test | Not tested |
  | R16 | CI/CD | No job isolation between client runners | 🟠 High | Security test | Not tested |
  | R17 | Gitea | `uid=0` OAuth grants admin-level trust to all OAuth users | 🟠 High | Security test | Not tested |
  | R18 | Gitea | `uid=0` bypass breaks on Gitea upgrade | 🟠 High | Regression test | Not tested |
  | R19 | Gitea | CORS wildcard misconfiguration | 🟠 High | Config audit | Not tested |
  | R20 | Gitea | Cloudflare Tunnel permanently exposes admin panel | 🟠 High | Config audit | Not tested |
  | R21 | Gitea | Admin password in temp scripts | 🔴 Critical | Static scan | Not tested |
  | R22 | Gitea | No 2FA on admin account | 🟠 High | Config audit | Not tested |
  | R23 | CF Pages | Single Cloudflare token for all projects | 🔴 Critical | Config audit | Not tested |
  | R24 | CMS | Client can write to `.gitea/workflows/` | 🔴 Critical | Security test | Not tested |
  | R25 | CMS | No brute-force protection on Gitea login | 🟠 High | Config audit | Not tested |
  | R26 | Supply chain | Docker `latest` tags | 🟠 High | Config audit | Not tested |
  | R27 | Supply chain | No `npm audit` in CI | 🟡 Medium | Config audit | Not tested |
