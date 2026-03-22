# Sveltia + Gitea Self-Hosted Trial Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate that a self-hosted Gitea instance eliminates the two blockers found in the Gitea Cloud trial — CORS restrictions and the OAuth consent screen.

**Architecture:** Gitea + act runner on a single Hetzner VPS (Docker Compose). Same `client-test` → Gitea Actions → CF Pages pipeline as the Cloud trial, but without the CF Worker CORS proxy and without the first-login consent screen.

**Tech Stack:** Hetzner CX22 (~€4/mo), Docker Compose, Gitea 1.25+, act runner, Gitea API, Wrangler CLI, Cloudflare Pages

**Success criteria:**
1. `/admin/` loads Sveltia CMS with no CF Worker proxy in `config.yml`
2. OAuth login completes with zero consent screen (not even first-time)
3. Content edit → commit → CF Pages deploy loop works end-to-end

**Known limitation:** This trial uses plain HTTP (`http://<server-ip>/`) for Gitea. Browsers may block OAuth redirects from an HTTPS page (Sveltia on CF Pages) to a plain HTTP Gitea as mixed content. If the OAuth flow fails in the browser, check the DevTools console for mixed-content errors before assuming a Gitea configuration issue. HTTPS on Gitea is deferred — add a Let's Encrypt cert for production.

**Prerequisite:** The Cloud trial artefacts at `/tmp/client-test` are reused in Task 5. If that directory no longer exists, recreate it by following Tasks 2–4 of `2026-03-21-sveltia-gitea-trial.md`.

---

## Task 1: Provision Hetzner VPS

- [ ] **Step 1: Create server**

  In Hetzner Cloud (`console.hetzner.cloud`): New Server → Location: Nuremberg → Ubuntu 24.04 → CX22 (2 vCPU, 4 GB RAM) → Add your SSH public key → Create.

  Note the server IP.

- [ ] **Step 2: Point a subdomain at the server**

  Add an A record: `gitea.yourdomain.com` → server IP. (Or use the bare IP for the trial — substitute `<server-ip>` throughout.)

- [ ] **Step 3: SSH in and install Docker**

```bash
ssh root@<server-ip>
apt update && apt install -y docker.io docker-compose-plugin
```

---

## Task 2: Install Gitea via Docker Compose

- [ ] **Step 1: Create the Compose file**

```bash
mkdir -p /opt/gitea && cat > /opt/gitea/docker-compose.yml << 'EOF'
services:
  gitea:
    image: gitea/gitea:1.25
    restart: always
    ports:
      - "80:3000"
      - "22:22"
    volumes:
      - ./data:/data
    environment:
      - GITEA__server__ROOT_URL=http://<server-ip>/
      - GITEA__cors__ENABLED=true
      - GITEA__cors__ALLOW_DOMAIN=*
      - GITEA__cors__ALLOW_CREDENTIALS=true
      - GITEA__cors__METHODS=GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS
      - GITEA__mailer__ENABLED=true
      - GITEA__mailer__FROM=noreply@yourdomain.com
      - GITEA__mailer__PROTOCOL=smtp+starttls
      - GITEA__mailer__SMTP_ADDR=<smtp-host>
      - GITEA__mailer__SMTP_PORT=587
      - GITEA__mailer__USER=<smtp-user>
      - GITEA__mailer__PASSWD=<smtp-password>
EOF
```

Replace `<server-ip>` and SMTP values with real ones. For SMTP, Brevo free tier works.

- [ ] **Step 2: Start Gitea**

```bash
cd /opt/gitea && docker compose up -d
```

- [ ] **Step 3: Complete setup wizard**

Visit `http://<server-ip>/`. Fill in admin username (`foovepages`), password, email. Submit. Gitea is running.

---

## Task 3: Create trusted OAuth app via admin API

This is the key validation — admin API must exist on self-hosted and `trusted: true` must skip the consent screen.

- [ ] **Step 1: Create the OAuth app**

```bash
curl -s -u "foovepages:<password>" -X POST "http://<server-ip>/api/v1/admin/oauth2" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "autosite-cms",
    "redirect_uris": ["https://autosite-selfhosted.pages.dev/admin/"],
    "confidential_client": false,
    "trusted": true
  }'
```

Expected: JSON response with `client_id` and `"trusted": true`. Note the `client_id`.

If the endpoint returns 404: the admin API is not available on this Gitea version — **stop and record as a blocker**.

- [ ] **Step 2: Verify trusted is set**

```bash
curl -s -u "foovepages:<password>" "http://<server-ip>/api/v1/admin/oauth2" | \
  python3 -c "import json,sys; [print(a['name'], 'trusted:', a.get('trusted')) for a in json.load(sys.stdin)]"
```

Expected: `autosite-cms trusted: True`

---

## Task 4: Set up act runner

- [ ] **Step 1: Get runner registration token first**

In Gitea: Site Administration → Actions → Runners → **New Runner** → copy the registration token.

- [ ] **Step 2: Add act runner to Compose with the real token**

```bash
cat >> /opt/gitea/docker-compose.yml << EOF

  runner:
    image: gitea/act_runner:latest
    restart: always
    depends_on:
      - gitea
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - GITEA_INSTANCE_URL=http://gitea:3000
      - GITEA_RUNNER_REGISTRATION_TOKEN=<paste-token-here>
EOF
```

Replace `<paste-token-here>` with the token from Step 1 before running.

- [ ] **Step 3: Start runner and verify**

```bash
cd /opt/gitea && docker compose up -d
```

In Gitea: Site Administration → Actions → Runners — runner should appear as **Online** within ~30 seconds.

If no runner appears: check `docker compose logs runner`. The runner registers on first start; if it fails, the token may have expired (they are single-use on some versions — generate a new one and recreate the container).

**Verify `ubuntu-latest` label is supported:**

```bash
docker compose exec runner gitea-act-runner list
```

The runner's labels should include `ubuntu-latest`. If they don't, the workflow job will queue indefinitely. In that case, change `runs-on: ubuntu-latest` in the deploy workflow to `runs-on: self-hosted`.

---

## Task 5: Push dental-template + create client-selfhosted repo

- [ ] **Step 1: Create `dental-template` repo on self-hosted Gitea (Public)**

```bash
curl -s -u "foovepages:<password>" -X POST "http://<server-ip>/api/v1/user/repos" \
  -H "Content-Type: application/json" \
  -d '{"name":"dental-template","private":false}'
```

- [ ] **Step 2: Push dental-template from local**

```bash
cd /Users/masidawoud/Dev/autosite
git remote add gitea-self "http://foovepages:<password>@<server-ip>/foovepages/dental-template.git"
git subtree push --prefix dental-template gitea-self master:main
```

- [ ] **Step 3: Create CF Pages project for this trial**

```bash
cd dental-template && export $(grep -v '^#' ../.env | xargs) && \
  npx wrangler@3 pages project create autosite-selfhosted --production-branch=main
```

- [ ] **Step 4: Create `client-selfhosted` repo (Private)**

```bash
curl -s -u "foovepages:<password>" -X POST "http://<server-ip>/api/v1/user/repos" \
  -H "Content-Type: application/json" \
  -d '{"name":"client-selfhosted","private":true}'
```

- [ ] **Step 5: Prepare local client-selfhosted directory**

```bash
cp -r /tmp/client-test /tmp/client-selfhosted
cd /tmp/client-selfhosted
```

Edit `admin/config.yml` — replace these fields:
```yaml
backend:
  base_url: http://<server-ip>
  api_root: http://<server-ip>/api/v1
  app_id: <client_id-from-task-3>
  repo: foovepages/client-selfhosted
```

Edit `.gitea/workflows/deploy.yml` — replace the clone URL and project name:
```yaml
- name: Clone dental-template
  run: git clone http://<server-ip>/foovepages/dental-template.git template
```
```yaml
run: npx wrangler@3 pages deploy dist --project-name=${{ secrets.CF_PROJECT_NAME }}
```
(The `CF_PROJECT_NAME` secret will be `autosite-selfhosted` — set in Step 6.)

Re-initialise the repo pointing at the self-hosted remote:
```bash
rm -rf .git
git init
git checkout -b main
git remote add origin "http://foovepages:<password>@<server-ip>/foovepages/client-selfhosted.git"
git add .
git commit -m "feat: initial client-selfhosted content"
git push -u origin main
```

- [ ] **Step 6: Add repo secrets**

```bash
SERVER=http://<server-ip>
REPO=foovepages/client-selfhosted
AUTH="foovepages:<password>"

source /Users/masidawoud/Dev/autosite/.env

for NAME_VAL in \
  "CLOUDFLARE_API_TOKEN:$CLOUDFLARE_API_TOKEN" \
  "CLOUDFLARE_ACCOUNT_ID:$CLOUDFLARE_ACCOUNT_ID" \
  "CF_PROJECT_NAME:autosite-selfhosted" \
  "OPERATOR_TOKEN:<gitea-api-token>"; do
  NAME="${NAME_VAL%%:*}"
  VALUE="${NAME_VAL#*:}"
  curl -s -u "$AUTH" -X PUT "$SERVER/api/v1/repos/$REPO/actions/secrets/$NAME" \
    -H "Content-Type: application/json" \
    -d "{\"data\":\"$VALUE\"}"
  echo "Added $NAME"
done
```

`OPERATOR_TOKEN` is the Gitea personal access token for `foovepages` — used by the workflow to clone `dental-template` if it is ever made private. For this trial, `dental-template` is public, so `OPERATOR_TOKEN` is not consumed by the workflow; it is included to match the production provisioning pattern.

---

## Task 6: Verify CI/CD without CORS proxy

The `config.yml` in `client-selfhosted` points `base_url` and `api_root` directly at the self-hosted Gitea — no CF Worker proxy. This is the CORS validation.

- [ ] **Step 1: Trigger workflow**

```bash
cd /tmp/client-selfhosted && git commit --allow-empty -m "chore: trigger self-hosted CI/CD" && git push
```

- [ ] **Step 2: Watch Actions run**

In Gitea: `client-selfhosted` → Actions. All 5 steps should pass (~2 minutes).

If the job queues but never starts: the runner label doesn't match. Check Task 4 Step 3 runner label fix (`self-hosted` vs `ubuntu-latest`). Update the workflow's `runs-on` and push another empty commit.

If `wrangler pages deploy` fails: verify all 4 secrets are set correctly (Task 5 Step 6). Check secret names are exact.

- [ ] **Step 3: Verify live site and admin**

Visit `https://autosite-selfhosted.pages.dev` — dental site loads.

Visit `https://autosite-selfhosted.pages.dev/admin/` — Sveltia loads without any CF Worker proxy.

If Sveltia fails with a CORS error: verify CORS is active:
```bash
ssh root@<server-ip> docker compose -f /opt/gitea/docker-compose.yml exec gitea env | grep cors
```
Expected: `GITEA__cors__ENABLED=true` in output.

If the browser shows a mixed-content error (HTTPS → HTTP): see the Known Limitation note in the header. For the trial, try using Firefox which is more permissive, or set up a self-signed cert.

---

## Task 7: Verify trusted OAuth — zero consent screen

- [ ] **Step 1: Create test client user**

```bash
curl -s -u "foovepages:<password>" -X POST "http://<server-ip>/api/v1/admin/users" \
  -H "Content-Type: application/json" \
  -d '{"username":"test-client","email":"test@example.com","password":"TrialPass123!","must_change_password":false}'
```

- [ ] **Step 2: Grant Write access to client-selfhosted**

```bash
curl -s -u "foovepages:<password>" -X PUT \
  "http://<server-ip>/api/v1/repos/foovepages/client-selfhosted/collaborators/test-client" \
  -H "Content-Type: application/json" \
  -d '{"permission":"write"}'
```

- [ ] **Step 3: Log in to Sveltia as test-client in a private window**

Visit `https://autosite-selfhosted.pages.dev/admin/`. Click Sign in.

**Expected (trusted app):** Gitea login page → enter `test-client` credentials → immediately redirected back to Sveltia CMS. **No consent screen.**

**If consent screen appears:** `trusted: true` does not suppress it. Debug steps:
1. Confirm Task 3 Step 2 still shows `trusted: True` (it should — nothing changed it)
2. Check Gitea version: `docker compose exec gitea gitea --version` — trusted app behaviour was introduced in Gitea 1.21; if the image pulled an older version, upgrade
3. Record as a finding: the one-time consent screen (confirmed acceptable in Cloud trial) remains, and production will use first-login consent

- [ ] **Step 4: Edit content + verify auto-deploy**

Edit the hero headline in Sveltia → Save → verify commit on `client-selfhosted` Gitea → workflow runs → `https://autosite-selfhosted.pages.dev` updates.

---

## Trial Complete — Record Outcomes

- [ ] CORS works without CF Worker proxy: ✅ / ❌ + notes
- [ ] `POST /api/v1/admin/oauth2` available on self-hosted: ✅ / ❌
- [ ] `trusted: true` eliminates consent screen: ✅ / ❌ + notes
- [ ] act runner picks up `ubuntu-latest` jobs: ✅ / ❌ + notes
- [ ] Full edit → commit → deploy loop: ✅ / ❌

If all ✅: proceed to production implementation plan (scripting full client provisioning into `build-sites.js`).
