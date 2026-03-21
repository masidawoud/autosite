# Sveltia CMS + Gitea Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate two things — (a) Sveltia CMS auth and content editing against a Gitea-hosted repo, and (b) a Gitea Actions → Wrangler → Cloudflare Pages CI/CD pipeline.

**Architecture:** A `trial/sveltia-gitea` branch adds `public/admin/index.html` to `dental-template/`, which is then pushed as a standalone repo to Gitea Cloud. A separate `client-test` repo on Gitea holds content files and a deploy workflow; on every push, Gitea Actions clones `dental-template`, injects the content, builds with Astro, and deploys to Cloudflare Pages via Wrangler CLI.

**Tech Stack:** Astro 4, Sveltia CMS (CDN), Gitea Cloud Enterprise (30-day trial), Gitea Actions (hosted runners), Wrangler CLI, Cloudflare Pages

---

## File Map

| File | Location | Action |
|---|---|---|
| `dental-template/public/admin/index.html` | This repo | **Create** — Sveltia CMS loader |
| Gitea repo: `operator/dental-template` | Gitea Cloud | **Create** — pushed from local via `git subtree push` |
| Gitea repo: `operator/client-test` | Gitea Cloud | **Create** — content-only repo |
| `client-test/site.json` | Gitea | **Create** — copy of local `dental-template/src/data/site.json` |
| `client-test/theme.json` | Gitea | **Create** — copy of local `dental-template/src/data/theme.json` |
| `client-test/sections.json` | Gitea | **Create** — minimal sections list (not yet consumed by template; present for data model validation) |
| `client-test/admin/config.yml` | Gitea | **Create** — Sveltia config pointing at `operator/client-test` |
| `client-test/.gitea/workflows/deploy.yml` | Gitea | **Create** — build + deploy workflow |

---

## Task 1: Create trial branch + add Sveltia admin page

**Files:**
- Create: `dental-template/public/admin/index.html`

- [ ] **Step 1: Create branch**

```bash
git checkout -b trial/sveltia-gitea
```

- [ ] **Step 2: Create the Sveltia loader**

Create `dental-template/public/admin/index.html` with this exact content:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>Content Manager</title>
</head>
<body>
  <script src="https://unpkg.com/sveltia-cms/dist/sveltia-cms.js"></script>
</body>
</html>
```

Sveltia CMS fetches `config.yml` relative to the page URL — because this page is served at `/admin/`, it fetches `/admin/config.yml`. The `config.yml` file is added in Task 4 and copied into `public/admin/` during the build workflow. No other configuration goes in this HTML file.

- [ ] **Step 3: Verify locally**

```bash
cd dental-template && npm run dev
```

Visit `http://localhost:4321/admin`. You should see a Sveltia CMS loading screen or error about missing `config.yml`. Either is correct — `config.yml` is added in Task 4. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add dental-template/public/admin/index.html
git commit -m "feat: add Sveltia CMS admin loader to dental-template"
```

---

## Task 2: Set up Gitea Cloud trial + push dental-template

**Prerequisites:** You need a Gitea Cloud trial account. Go to `about.gitea.com`, start a 30-day Enterprise trial. Note the domain you're given — it will be something like `[your-org].gitea.cloud`. Substitute `[gitea-domain]` throughout this plan with that actual domain.

- [ ] **Step 1: Create the `dental-template` repo on Gitea**

In the Gitea web UI: New Repository → name it `dental-template` → set visibility to **Public** → do not initialise with README → Create.

Public is required because the Gitea Actions workflow in `client-test` clones it without authentication.

- [ ] **Step 2: Add Gitea as a remote**

```bash
git remote add gitea-template https://[gitea-domain]/[your-username]/dental-template.git
```

- [ ] **Step 3: Push only the `dental-template/` subdirectory to Gitea**

The Gitea repo should contain the Astro project root (what's inside `dental-template/`), not the whole autosite repo. Use `git subtree push`:

Ensure you are on the `trial/sveltia-gitea` branch before running this — `git subtree push` synthesises history from the current branch:

```bash
git subtree push --prefix dental-template gitea-template trial/sveltia-gitea:main
```

This pushes the contents of `dental-template/` (from the `trial/sveltia-gitea` branch) as the root of the Gitea repo's `main` branch. Expected output ends with `Counting objects` and a successful push line.

- [ ] **Step 4: Verify on Gitea**

Open `https://[gitea-domain]/[your-username]/dental-template` in a browser. You should see `src/`, `public/`, `astro.config.mjs`, `package.json` at the root. Confirm `public/admin/index.html` is present.

---

## Task 3: Register Gitea OAuth application

Sveltia CMS uses Gitea's OAuth2 PKCE flow. One OAuth app covers all client repos.

- [ ] **Step 1: Create the OAuth app**

In Gitea: Settings (top right) → Applications → OAuth2 Applications → **Create OAuth2 Application**.

Fill in:
- Application name: `autosite-cms`
- Redirect URI: `https://autosite-trial.pages.dev/admin/` — this is the CF Pages domain you will create in Task 5. The project name `autosite-trial` is fixed, so you can enter the final URL now.
- Leave all other fields default

Click Create. Gitea shows you a **Client ID**. Note it — this is the `app_id` for the Sveltia config.

Note: OAuth2 PKCE flow does not use a client secret, so you only need the Client ID.

- [ ] **Step 2: Record the Client ID**

Write it down or keep the tab open. You'll need it in Task 4 Step 5.

---

## Task 4: Create client-test repo on Gitea with all content files

This repo represents a client's content repository. All files are created via the Gitea web UI or via a local git init + push.

**Fastest approach:** create files locally, push to Gitea.

- [ ] **Step 1: Create the `client-test` repo on Gitea**

In Gitea: New Repository → name `client-test` → **Private** → do not initialise → Create.

Note the clone URL: `https://[gitea-domain]/[your-username]/client-test.git`

- [ ] **Step 2: Create the repo locally and push**

```bash
mkdir /tmp/client-test && cd /tmp/client-test
git init
git remote add origin https://[gitea-domain]/[your-username]/client-test.git
```

- [ ] **Step 3: Copy content files from dental-template**

```bash
cp /Users/masidawoud/Dev/autosite/dental-template/src/data/site.json .
cp /Users/masidawoud/Dev/autosite/dental-template/src/data/theme.json .
```

- [ ] **Step 4: Create sections.json**

```bash
cat > sections.json << 'EOF'
{
  "sections": [
    { "id": "hero",       "enabled": true },
    { "id": "quote",      "enabled": true },
    { "id": "features",   "enabled": true },
    { "id": "services",   "enabled": true },
    { "id": "team",       "enabled": true },
    { "id": "reviews",    "enabled": true },
    { "id": "hours",      "enabled": true },
    { "id": "vergoeding", "enabled": true },
    { "id": "contact",    "enabled": true }
  ]
}
EOF
```

Note: `sections.json` is not yet read by the template — it is included here to validate the data model and the Sveltia list widget in Task 6.

- [ ] **Step 5: Create `admin/config.yml`**

```bash
mkdir admin
cat > admin/config.yml << 'EOF'
backend:
  name: gitea
  repo: [your-username]/client-test
  base_url: https://[gitea-domain]
  api_root: https://[gitea-domain]/api/v1
  app_id: [your-oauth-client-id-from-task-3]

media_folder: public/images
public_folder: /images

collections:
  - name: content
    label: Site Content
    files:
      - name: site
        label: Site Settings
        file: site.json
        fields:
          - name: business
            label: Business Info
            widget: object
            fields:
              - { name: name,  label: Practice Name, widget: string }
              - { name: city,  label: City,          widget: string }
              - { name: phone, label: Phone,         widget: string }
              - { name: email, label: Email,         widget: string }
          - name: hero
            label: Hero Section
            widget: object
            fields:
              - { name: headline,    label: Headline,    widget: string }
              - { name: description, label: Description, widget: text   }

  - name: sections
    label: Page Sections
    files:
      - name: sections
        label: Section Order
        file: sections.json
        fields:
          - name: sections
            label: Sections
            widget: list
            fields:
              - { name: id,      label: Section, widget: string  }
              - { name: enabled, label: Enabled, widget: boolean }
EOF
```

Replace `[your-username]`, `[gitea-domain]`, and `[your-oauth-client-id-from-task-3]` with real values.

- [ ] **Step 6: Create `.gitea/workflows/deploy.yml`**

```bash
mkdir -p .gitea/workflows
cat > .gitea/workflows/deploy.yml << 'EOF'
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: https://github.com/actions/checkout@v4

      - name: Clone dental-template
        run: git clone https://[gitea-domain]/[your-username]/dental-template.git template

      - name: Inject client content
        run: |
          cp site.json template/src/data/
          cp theme.json template/src/data/
          cp sections.json template/src/data/
          cp admin/config.yml template/public/admin/config.yml

      - name: Build
        working-directory: template
        run: npm ci && npm run build

      - name: Deploy
        working-directory: template
        run: npx wrangler@3 pages deploy dist --project-name=${{ secrets.CF_PROJECT_NAME }}
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
EOF
```

Replace `[gitea-domain]` and `[your-username]` with real values.

- [ ] **Step 7: Commit and push**

```bash
git add .
git commit -m "feat: initial client-test content + Sveltia config + deploy workflow"
git push -u origin main
```

Expected: push succeeds. On Gitea, verify all files appear in the repo.

---

## Task 5: Create Cloudflare Pages project for the trial

- [ ] **Step 1: Create the CF Pages project**

From the autosite repo root:

```bash
cd /Users/masidawoud/Dev/autosite/dental-template
npx wrangler@3 pages project create autosite-trial
```

Expected output confirms the project is created. Verify it: open `https://dash.cloudflare.com` → Pages — `autosite-trial` should appear in the project list. If `wrangler` exits silently with no error but the project is not visible in the dashboard, re-run the command or check your `CLOUDFLARE_API_TOKEN` in `.env`.

The live domain will be `autosite-trial.pages.dev`. If this name is already taken, choose a different name and substitute it throughout this plan and in the Gitea OAuth redirect URI configured in Task 3.

- [ ] **Step 3: Add secrets to the `client-test` repo on Gitea**

In Gitea: open `client-test` repo → Settings → Actions → Secrets → Add Secret.

Add three secrets:

| Name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Your existing token from `.env` |
| `CLOUDFLARE_ACCOUNT_ID` | Your existing account ID from `.env` |
| `CF_PROJECT_NAME` | `autosite-trial` |

---

## Task 6: Create test Gitea user + grant repo access

This simulates a client account provisioned by the operator.

- [ ] **Step 1: Create a test user**

In Gitea: Site Administration (top right admin menu) → User Accounts → Create User Account.

Fill in:
- Username: `test-client`
- Email: use an email address you can access (needed for password reset test)
- Password: set a temporary password (e.g. `TrialPass123!`)
- Uncheck "Require password change" for now

Create the account.

- [ ] **Step 2: Add test-client as collaborator on client-test**

In Gitea: open `client-test` repo → Settings → Collaborators → Add Collaborator.

Search for `test-client`, set permission to **Write**. Add.

- [ ] **Step 3: Verify password reset flow**

Log out of Gitea admin. On the Gitea login page, click "Forgot password?" and enter the test-client email.

Expected: Gitea sends a reset email to that address. Open the email and follow the reset link to confirm the flow works end-to-end.

**Note:** This requires SMTP to be configured on the Gitea instance. On Gitea Cloud Enterprise, outgoing email is configured by default. If the reset email does not arrive, check Gitea site administration → Email Settings.

Log back in as admin when done.

---

## Task 7: Trigger first CI/CD run + verify Cloudflare Pages deployment

- [ ] **Step 1: Trigger the workflow by pushing a change**

From `/tmp/client-test`:

```bash
git commit --allow-empty -m "chore: trigger first CI/CD run"
git push
```

- [ ] **Step 2: Watch the workflow run on Gitea**

In Gitea: open `client-test` → Actions tab. A workflow run should appear within seconds.

If no run appears after 30 seconds: Gitea Actions or hosted runners may not be enabled for your organisation. Check: Gitea Cloud dashboard → your organisation → Settings → Actions — ensure Actions are enabled and at least one hosted runner is listed. On Gitea Cloud Enterprise, hosted runners should be available by default; if the list is empty, contact Gitea Cloud support.

Click into the run and watch the logs. Expected sequence:
1. `Checkout` — clones `client-test`
2. `Clone dental-template` — clones `dental-template` from Gitea
3. `Inject client content` — copies JSON files
4. `Build` — `npm ci` then `astro build` (takes ~60–90 seconds)
5. `Deploy` — `wrangler pages deploy` outputs upload progress and confirms deployment

Expected final log line from wrangler: something like `✨ Deployment complete! https://[hash].autosite-trial.pages.dev`

- [ ] **Step 3: Verify the live site**

Visit `https://autosite-trial.pages.dev`. The dental practice site should load with the content from `site.json` and theme from `theme.json`.

Visit `https://autosite-trial.pages.dev/admin/`. Sveltia CMS should load (a blank-ish screen with a "Sign In with Gitea" button or similar prompt).

**If the workflow fails:** check the Gitea Actions log for the failing step. Common issues:
- `Clone dental-template` fails → `dental-template` repo is private or URL is wrong
- `npm ci` fails → `package-lock.json` was not pushed to Gitea (the `git subtree push` in Task 2 should have included it)
- `wrangler pages deploy` fails → check that all three secrets are set correctly in Step 3 of Task 5

---

## Task 8: Verify Sveltia CMS auth + content edit → auto-deploy loop

This is the final validation of both trial goals.

- [ ] **Step 1: Log into Sveltia CMS as test-client**

Visit `https://autosite-trial.pages.dev/admin/`.

Sveltia should show a "Sign in with Gitea" button (or initiate the OAuth flow automatically). Click it. A Gitea login popup or redirect opens.

Log in with `test-client` / the password set in Task 6.

Gitea will show an OAuth authorisation screen: "autosite-cms is requesting access to your account". Click **Authorize**.

Expected: redirected back to `https://autosite-trial.pages.dev/admin/` and Sveltia loads the CMS editor with the `Site Content` and `Page Sections` collections in the sidebar.

- [ ] **Step 2: Edit a content field**

Click `Site Content` → `Site Settings`. Find the `Hero Section` → `Headline` field.

Change it from `Tandheelkunde ontworpen om goed te voelen.` to `Tandheelkunde die écht bij u past.`

Click **Save** (or Publish, depending on Sveltia's workflow mode). Sveltia commits the change to `client-test` on Gitea.

- [ ] **Step 3: Verify the commit on Gitea**

Open `https://[gitea-domain]/[your-username]/client-test` → commits. A new commit should appear authored by `test-client` with a message like `Update site.json`.

- [ ] **Step 4: Verify Gitea Actions triggers**

In `client-test` → Actions, a new workflow run should start automatically within seconds of the commit.

Wait for it to complete (~2 minutes). Check all steps pass.

- [ ] **Step 5: Verify the live site updated**

Visit `https://autosite-trial.pages.dev`. The hero headline should now read `Tandheelkunde die écht bij u past.`

Hard-refresh if needed (`Cmd+Shift+R`).

- [ ] **Step 6: Test the sections list widget**

Back in the CMS, click `Page Sections` → `Section Order`. You should see a list of sections with toggle buttons (enabled/disabled). Try moving one with the arrow handles.

Save. Verify a new commit appears on Gitea. (The template does not yet consume `sections.json` so the live site won't change — this only validates the CMS data model.)

---

## Trial Complete — Record Outcomes

After Task 8, document the following in a comment or note:

- [ ] CI/CD pipeline works end-to-end: ✅ / ❌ + notes
- [ ] Sveltia CMS loads at `/admin/`: ✅ / ❌ + notes
- [ ] Gitea OAuth auth flow works: ✅ / ❌ + notes
- [ ] Content edit → commit → auto-deploy loop works: ✅ / ❌ + notes
- [ ] Password reset email received: ✅ / ❌ + notes
- [ ] Sections list widget visible and reorderable: ✅ / ❌ + notes
- [ ] Any unexpected issues or open questions discovered

These outcomes determine whether to proceed to the full production implementation plan.
