# TinaCMS Self-Hosted with Email/Password Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Tina Cloud auth in the existing `feature/tinacms` branch with a self-hosted TinaCMS backend on Fly.io so dental clients log in with email/password — no GitHub account required.

**Architecture:** A new `feature/tinacms-authjs` branch is cut from `feature/tinacms` (TinaCMS already installed, full `site.json` schema already written). A new `tina-backend/` directory is added to the repo: a Node.js Express app using `TinaNodeBackend` from `@tinacms/datalayer` with `AuthJsBackendAuthProvider` from `tinacms-authjs`. This backend is deployed to Fly.io. `dental-template/tina/config.ts` is updated to replace Tina Cloud credentials with `contentApiUrlOverride` pointing to the Fly.io backend URL, and the frontend auth provider switches from Tina Cloud to `UsernamePasswordAuthJSProvider`. The Astro site stays fully static on Cloudflare Pages; only the backend changes.

**Tech Stack:** TinaCMS 3.x, `@tinacms/datalayer`, `tinacms-authjs`, `next-auth` v4, `tinacms-gitprovider-github`, Express, Node.js 20, Upstash Redis via `upstash-redis-level` (indexing cache), Fly.io, GitHub PAT (git writes), Cloudflare Pages (site hosting, unchanged)

> **⚠️ Known spike risk — read before implementing Task 4:** `AuthJsBackendAuthProvider` from `tinacms-authjs` internally calls `next-auth` which assumes Next.js request types (`req.query.nextauth` routing, Next.js `ServerResponse`). Plain Express requests do not satisfy these assumptions. **If `AuthJsBackendAuthProvider` fails in Express**, skip directly to the fallback in the Troubleshooting section: implement `CustomAuthProvider` with a simple JWT instead. The fallback is ~50 lines, well-documented at `tina.io/docs/reference/self-hosted/auth-provider/bring-your-own`, and avoids next-auth entirely. Budget time for either path.

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `dental-template/tina/config.ts` | MODIFY | Remove Tina Cloud creds; add `contentApiUrlOverride` + `UsernamePasswordAuthJSProvider` |
| `dental-template/.env.example` | MODIFY | Swap Tina Cloud vars for self-hosted vars |
| `dental-template/package.json` | MODIFY | Add `tinacms-authjs` as devDep |
| `tina-backend/package.json` | CREATE | Backend deps: express, @tinacms/datalayer, tinacms-authjs, next-auth, tinacms-gitprovider-github, upstash-redis-level, @upstash/redis |
| `tina-backend/src/index.ts` | CREATE | Express server; mounts TinaNodeBackend at `/api/tina` |
| `tina-backend/src/database.ts` | CREATE | `createDatabase` with Upstash Redis adapter + GitHub git provider |
| `tina-backend/src/auth.ts` | CREATE | `AuthJsBackendAuthProvider` config + NEXTAUTH_SECRET |
| `tina-backend/content/users/index.json` | CREATE | Seeded demo user (username: admin, password changed on first login) |
| `tina-backend/.env.example` | CREATE | NEXTAUTH_SECRET, GITHUB_PAT, UPSTASH_REDIS_REST_URL/TOKEN |
| `tina-backend/fly.toml` | CREATE | Fly.io app config |
| `tina-backend/Dockerfile` | CREATE | Node 20 image, builds and starts the Express server |
| `tina-backend/tsconfig.json` | CREATE | TypeScript config for the backend |

---

## Task 1: Create feature/tinacms-authjs branch from feature/tinacms

**Files:** none

- [ ] **Step 1: Create branch from feature/tinacms**

```bash
cd /Users/masidawoud/Dev/autosite
git checkout feature/tinacms
git pull origin feature/tinacms
git checkout -b feature/tinacms-authjs
```

Expected: `Switched to a new branch 'feature/tinacms-authjs'`

- [ ] **Step 2: Verify**

```bash
git branch --show-current
git log --oneline -3
```

Expected: branch is `feature/tinacms-authjs`, and the last 3 commits are from the `feature/tinacms` history (TinaCMS schema + build fixes).

- [ ] **Step 3: Commit branch creation marker**

```bash
git commit --allow-empty -m "chore: branch feature/tinacms-authjs from feature/tinacms — switching to self-hosted auth"
```

---

## Task 2: Scaffold tina-backend/ Node.js project

**Files:**
- Create: `tina-backend/package.json`
- Create: `tina-backend/tsconfig.json`
- Create: `tina-backend/.env.example`
- Create: `tina-backend/content/users/index.json`

- [ ] **Step 1: Create tina-backend directory and package.json**

```bash
mkdir -p /Users/masidawoud/Dev/autosite/tina-backend/src
mkdir -p /Users/masidawoud/Dev/autosite/tina-backend/content/users
```

Create `tina-backend/package.json`:

```json
{
  "name": "tina-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@tinacms/datalayer": "^1.0.0",
    "@upstash/redis": "^1.28.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "express": "^4.18.0",
    "next-auth": "^4.24.0",
    "tinacms-authjs": "^0.0.16",
    "tinacms-gitprovider-github": "^0.0.10",
    "upstash-redis-level": "^0.1.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Note on versions:** Run `npm view tinacms-authjs versions` and `npm view @tinacms/datalayer versions` to confirm latest before installing. Pin to whatever `dental-template/` uses for `tinacms` to avoid version mismatches.

- [ ] **Step 2: Create tsconfig.json**

Create `tina-backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

`NodeNext` module resolution enforces explicit `.js` extensions on all internal imports (required for ESM output). All `import` statements in `src/` must use `./file.js` suffixes even though the source files are `.ts`.

- [ ] **Step 3: Create .env.example**

Create `tina-backend/.env.example`:

```
# Auth.js — generate with: openssl rand -base64 32
NEXTAUTH_SECRET=

# URL this backend is deployed at (used by next-auth for callbacks)
NEXTAUTH_URL=https://your-app.fly.dev

# GitHub Personal Access Token — needs repo read/write access to the client content repo
# Create at: github.com/settings/tokens → Fine-grained → repo contents read+write
GITHUB_PERSONAL_ACCESS_TOKEN=

# The client content repo (where site.json lives)
GITHUB_OWNER=masidawoud
GITHUB_REPO=demo-tandarts
GITHUB_BRANCH=main

# Upstash Redis — free tier at upstash.com
# Used by TinaCMS datalayer as an indexing cache
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 4: Seed initial user**

Create `tina-backend/content/users/index.json`:

```json
{
  "users": [
    {
      "name": "Admin",
      "email": "admin@demo-tandarts.nl",
      "username": "admin",
      "password": "admin"
    }
  ]
}
```

**Important:** TinaCMS AuthJS prompts the user to change the default password on first login. The plaintext password here is only used for initial access and is replaced with a bcrypt hash after the first login. Do not reuse this password in production.

- [ ] **Step 5: Commit scaffold**

```bash
cd /Users/masidawoud/Dev/autosite
git add tina-backend/
git commit -m "chore: scaffold tina-backend Node.js project"
```

---

## Task 3: Install tina-backend dependencies

**Files:**
- Create: `tina-backend/node_modules/` (auto)
- Create: `tina-backend/package-lock.json` (auto)

- [ ] **Step 1: Install deps**

```bash
cd /Users/masidawoud/Dev/autosite/tina-backend
npm install
```

Expected: `node_modules/` created, `package-lock.json` written, no peer dep errors.

If there are peer dep conflicts between `next-auth` and `tinacms-authjs`, add `--legacy-peer-deps` and note the conflict here for future reference.

- [ ] **Step 2: Check @tinacms/datalayer exports**

Run to confirm `TinaNodeBackend` is exported:

```bash
node -e "import('@tinacms/datalayer').then(m => console.log(Object.keys(m)))"
```

Expected: output includes `TinaNodeBackend`, `createDatabase`, `GitHubProvider` (or similar). If the export names differ, note the correct names — the implementation in Task 4 must use them exactly.

- [ ] **Step 3: Check tinacms-authjs exports**

```bash
node -e "import('tinacms-authjs').then(m => console.log(Object.keys(m)))"
```

Expected: includes `AuthJsBackendAuthentication` and `TinaAuthJSOptions`. Also confirm the parameter name used in `TinaNodeBackend` for the auth object — if it differs from `authentication`, update `index.ts` accordingly.

- [ ] **Step 3b: Confirm createDatabase is async or sync**

```bash
node -e "import('@tinacms/datalayer').then(m => { const result = m.createDatabase({ gitProvider: {}, databaseAdapter: {} }); console.log(result instanceof Promise ? 'async' : 'sync'); })"
```

If `sync`: remove `async`/`await` from `buildDatabase()` in `database.ts` and `index.ts`.

**If exports differ significantly from what's used in Task 4**, update the implementation accordingly. The exact API surface may differ from the Next.js docs since this is a standalone Node.js usage.

- [ ] **Step 4: Add tina-backend to .gitignore**

Edit the root `.gitignore` to add:

```
tina-backend/node_modules/
tina-backend/dist/
tina-backend/.env
```

```bash
cd /Users/masidawoud/Dev/autosite
git add .gitignore
git commit -m "chore: gitignore tina-backend build artifacts"
```

---

## Task 4: Implement the Express backend

**Files:**
- Create: `tina-backend/src/database.ts`
- Create: `tina-backend/src/auth.ts`
- Create: `tina-backend/src/index.ts`

### Step 1 — database.ts

Create `tina-backend/src/database.ts`:

```typescript
import { createDatabase } from "@tinacms/datalayer";
import { GitHubProvider } from "tinacms-gitprovider-github";
import { Redis } from "@upstash/redis";
import { RedisLevel } from "upstash-redis-level";

export function buildDatabase() {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  return createDatabase({
    // GitHub git provider: reads/writes content files in the client repo via GitHub API
    gitProvider: new GitHubProvider({
      repo: process.env.GITHUB_REPO!,
      owner: process.env.GITHUB_OWNER!,
      token: process.env.GITHUB_PERSONAL_ACCESS_TOKEN!,
      branch: process.env.GITHUB_BRANCH!,
    }),
    // databaseAdapter: RedisLevel wraps @upstash/redis to satisfy the abstract-level
    // interface that TinaCMS datalayer uses for indexing GraphQL queries.
    databaseAdapter: new RedisLevel({
      redis,
    }),
    // tinaDirectory: path to the tina config in the CONTENT repo.
    // The demo-tandarts content repo does not have a tina/ dir — TinaCMS uses the
    // schema from the backend's own tina/ config at build time, not at runtime.
    // If createDatabase requires this, set it to "tina" and ensure the content repo
    // either has an empty tina/ dir or this param can be omitted.
    tinaDirectory: "tina",
  });
}
```

**Key points:**
- `GitHubProvider` from `tinacms-gitprovider-github` handles SHA tracking and error handling for GitHub API calls — no need to implement raw fetch logic.
- `databaseAdapter` (not `level`) is the correct parameter name in `@tinacms/datalayer`.
- `RedisLevel` from `upstash-redis-level` wraps the Redis client to satisfy the `abstract-level` interface.
- All runtime packages are in `dependencies` (not `devDependencies`) so they survive the `npm ci --omit=dev` step in Docker.

- [ ] **Step 1: Create database.ts as above**

- [ ] **Step 2: Verify adapter packages installed**

```bash
cd /Users/masidawoud/Dev/autosite/tina-backend
node -e "import('upstash-redis-level').then(m => console.log('ok', Object.keys(m)))"
node -e "import('tinacms-gitprovider-github').then(m => console.log('ok', Object.keys(m)))"
```

Expected: both print `ok [ 'RedisLevel', ... ]` / `ok [ 'GitHubProvider', ... ]`.

If either import fails, verify the package versions in `package.json` match what's available on npm:
```bash
npm view tinacms-gitprovider-github versions --json | tail -5
npm view upstash-redis-level versions --json | tail -5
```

### Step 2 — auth.ts

Create `tina-backend/src/auth.ts`:

```typescript
import { AuthJsBackendAuthentication, TinaAuthJSOptions } from "tinacms-authjs";
// Database is the object returned by createDatabase — NOT the generated DatabaseClient
// from tina/__generated__/databaseClient (which is the frontend typed GraphQL client).
import type { Database } from "@tinacms/datalayer";

export function buildAuthProvider(database: Database) {
  return AuthJsBackendAuthentication({
    authOptions: TinaAuthJSOptions({
      databaseClient: database,
      secret: process.env.NEXTAUTH_SECRET!,
    }),
  });
}
```

**Note:** `TinaAuthJSOptions` configures next-auth to validate credentials against the users collection stored in the content repo. If the import fails or `Database` is not exported from `@tinacms/datalayer`, use `any` as a temporary type and open the package source to find the correct type name.

**⚠️ If `AuthJsBackendAuthProvider` fails in Express:** Go directly to the Troubleshooting section (custom JWT fallback). See the warning at the top of the plan.

- [ ] **Step 3: Create auth.ts as above**

### Step 3 — index.ts

Create `tina-backend/src/index.ts`:

```typescript
import "dotenv/config";
import express from "express";
import cors from "cors";
import { TinaNodeBackend } from "@tinacms/datalayer";
import { buildDatabase } from "./database.js";
import { buildAuthProvider } from "./auth.js";

const app = express();

// Allow requests from the admin panel (any Cloudflare Pages domain)
app.use(
  cors({
    origin: (origin, cb) => cb(null, true),
    credentials: true,
  })
);

app.use(express.json());

const database = await buildDatabase();
const authProvider = buildAuthProvider(database);

// Mount TinaCMS at /api/tina — this handles:
//   POST /api/tina/gql   GraphQL queries + mutations (content read/write)
//   GET/POST /api/tina/auth/*  Auth.js routes (login, logout, session)
const tinaHandler = TinaNodeBackend({
  authentication: authProvider,
  databaseClient: database,
});

app.use("/api/tina", (req, res) => {
  // TinaNodeBackend expects the path without the /api/tina prefix
  req.url = req.url.replace(/^\/api\/tina/, "") || "/";
  tinaHandler(req, res);
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`tina-backend listening on :${PORT}`));
```

**Important caveat:** `TinaNodeBackend` in non-Next.js contexts may require different mounting. If this doesn't work as middleware, refer to the `@tinacms/datalayer` source for the correct handler signature. The health check at `/health` is used by Fly.io's health checks.

- [ ] **Step 4: Create index.ts as above**

- [ ] **Step 5: Smoke test locally (without Redis/GitHub)**

Copy `.env.example` to `.env` and fill in a dummy NEXTAUTH_SECRET to test the server starts:

```bash
cd /Users/masidawoud/Dev/autosite/tina-backend
cp .env.example .env
# Edit .env: set NEXTAUTH_SECRET to any 32+ char string for local testing
# Leave Redis/GitHub vars blank for now

npm run dev
```

Expected: server starts on port 3000. `curl http://localhost:3000/health` returns `{"ok":true}`.

If the server crashes due to missing Redis/GitHub env vars, add null-guards to `buildDatabase()` so it logs a warning but still starts (for local dev smoke testing only).

- [ ] **Step 6: Commit**

```bash
cd /Users/masidawoud/Dev/autosite
git add tina-backend/src/ tina-backend/package.json tina-backend/package-lock.json
git commit -m "feat: implement tina-backend Express server with TinaNodeBackend"
```

---

## Task 5: Configure Fly.io deployment

**Files:**
- Create: `tina-backend/fly.toml`
- Create: `tina-backend/Dockerfile`

- [ ] **Step 1: Create Dockerfile**

Create `tina-backend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src/ src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY content/ ./content/
COPY package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Note:** The `content/users/index.json` is baked into the Docker image. This is intentional for the spike — user data lives in the image, not a database. In production, move user management to the CMS itself (TinaCMS users collection writes back to the users JSON file).

- [ ] **Step 2: Create fly.toml**

Replace `tina-backend-demo` with the actual Fly.io app name you create in Step 3.

Create `tina-backend/fly.toml`:

```toml
app = "tina-backend-demo"
primary_region = "ams"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    path = "/health"
    timeout = "5s"

[env]
  NODE_ENV = "production"
```

`primary_region = "ams"` — Amsterdam, close to Dutch dental clients.
`auto_stop_machines = true` — machines sleep when idle (cost saving for a spike). Set `min_machines_running = 1` if cold starts become an issue.

- [ ] **Step 3: Create Fly.io app**

```bash
cd /Users/masidawoud/Dev/autosite/tina-backend
fly apps create tina-backend-demo
```

If `tina-backend-demo` is taken, use a different name and update `fly.toml`.

- [ ] **Step 4: Set secrets on Fly.io**

```bash
fly secrets set \
  NEXTAUTH_SECRET="$(openssl rand -base64 32)" \
  NEXTAUTH_URL="https://tina-backend-demo.fly.dev" \
  GITHUB_PERSONAL_ACCESS_TOKEN="<your-github-pat>" \
  GITHUB_OWNER="masidawoud" \
  GITHUB_REPO="demo-tandarts" \
  GITHUB_BRANCH="main" \
  UPSTASH_REDIS_REST_URL="<from-upstash-console>" \
  UPSTASH_REDIS_REST_TOKEN="<from-upstash-console>" \
  --app tina-backend-demo
```

**Before this step:**
- Create a free Upstash Redis database at [upstash.com](https://upstash.com) → grab the REST URL + token
- Create a GitHub Fine-Grained PAT at `github.com/settings/tokens/new` with **Contents: read+write** on the `demo-tandarts` repo only

- [ ] **Step 5: Deploy**

```bash
cd /Users/masidawoud/Dev/autosite/tina-backend
fly deploy --app tina-backend-demo
```

Expected: Docker build succeeds, machine starts, health check passes.

- [ ] **Step 6: Verify health check**

```bash
curl https://tina-backend-demo.fly.dev/health
```

Expected: `{"ok":true}`

- [ ] **Step 7: Commit**

```bash
cd /Users/masidawoud/Dev/autosite
git add tina-backend/fly.toml tina-backend/Dockerfile
git commit -m "feat: add Fly.io Dockerfile and fly.toml for tina-backend"
```

---

## Task 6: Update dental-template/tina/config.ts for self-hosted mode

**Files:**
- Modify: `dental-template/tina/config.ts`
- Modify: `dental-template/package.json`
- Modify: `dental-template/.env.example`

The current config uses Tina Cloud (`clientId` + `token`). We replace this with:
- `contentApiUrlOverride` pointing to the Fly.io backend
- `UsernamePasswordAuthJSProvider` for the frontend auth UI
- `LocalAuthProvider` in local dev mode (unchanged behavior for local editing)

- [ ] **Step 1: Install tinacms-authjs in dental-template**

```bash
cd /Users/masidawoud/Dev/autosite/dental-template
npm install --save-dev tinacms-authjs
```

- [ ] **Step 2: Update tina/config.ts**

Replace the top of `dental-template/tina/config.ts`. The schema (collections array) stays 100% unchanged — only the top-level config options change.

Current top of config:
```typescript
import { defineConfig } from "tinacms";

export default defineConfig({
  branch: process.env.GITHUB_BRANCH || "main",
  clientId: process.env.TINA_CLIENT_ID || "",
  token: process.env.TINA_TOKEN || "",

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },
  ...
```

Replace with:
```typescript
import { defineConfig, LocalAuthProvider } from "tinacms";
import { UsernamePasswordAuthJSProvider } from "tinacms-authjs/dist/tinacms";

const isLocal = process.env.TINA_PUBLIC_IS_LOCAL === "true";

export default defineConfig({
  // Self-hosted backend URL — points to Fly.io in production, unused in local mode
  contentApiUrlOverride: isLocal
    ? undefined
    : process.env.TINA_CONTENT_API_URL,

  authProvider: isLocal
    ? new LocalAuthProvider()
    : new UsernamePasswordAuthJSProvider(),

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },
  ...
```

**Do not change anything after the `build` block** — the full schema stays as-is.

- [ ] **Step 3: Update dental-template/.env.example**

Replace the Tina Cloud vars with self-hosted vars:

```
# TinaCMS — self-hosted mode
# Set to "true" to run TinaCMS with the local filesystem adapter (no backend needed)
# Set to "false" (or omit) to connect to the live self-hosted backend on Fly.io
TINA_PUBLIC_IS_LOCAL=true

# URL of the self-hosted tina-backend (only needed when TINA_PUBLIC_IS_LOCAL=false)
# Example: https://tina-backend-demo.fly.dev
TINA_CONTENT_API_URL=
```

- [ ] **Step 4: Verify local dev still works**

```bash
cd /Users/masidawoud/Dev/autosite/dental-template
cp .env.example .env
# .env should have TINA_PUBLIC_IS_LOCAL=true

npm run dev
```

Expected: TinaCMS starts in local mode (no backend needed), Astro dev server starts. Local admin editing works as before.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
cd /Users/masidawoud/Dev/autosite
git add dental-template/tina/config.ts dental-template/.env.example dental-template/package.json dental-template/package-lock.json
git commit -m "feat: switch tina/config.ts to self-hosted auth (UsernamePasswordAuthJSProvider)"
```

---

## Task 7: Update the GitHub Action in demo-tandarts repo

The GitHub Action in `demo-tandarts/.github/workflows/deploy.yml` currently sets `TINA_CLIENT_ID` and `TINA_TOKEN`. These must be replaced with the self-hosted vars.

**This task is in the demo-tandarts repo, not autosite.**

- [ ] **Step 1: Verify current state of demo-tandarts deploy.yml**

```bash
cd /tmp/demo-tandarts   # or wherever demo-tandarts is cloned locally
cat .github/workflows/deploy.yml
```

If the file doesn't exist, re-clone from the demo-tandarts GitHub repo first. Confirm whether the file has `TINA_CLIENT_ID`/`TINA_TOKEN` vars (from the original TinaCMS spike) or `DIRECTUS_URL`/`DIRECTUS_TOKEN` (from the abandoned Directus work). The steps below assume the TinaCMS-era file — adapt if it contains Directus vars instead.

- [ ] **Step 2: Update build env vars in deploy.yml**

In `demo-tandarts/.github/workflows/deploy.yml`, find the `Build` step:

```yaml
- name: Build
  run: npm run build
  working-directory: dental-template-repo/dental-template
  env:
    TINA_CLIENT_ID: ${{ vars.TINA_CLIENT_ID }}
    TINA_TOKEN: ${{ secrets.TINA_TOKEN }}
```

Replace with:

```yaml
- name: Build
  run: npm run build
  working-directory: dental-template-repo/dental-template
  env:
    TINA_PUBLIC_IS_LOCAL: "false"
    TINA_CONTENT_API_URL: ${{ vars.TINA_CONTENT_API_URL }}
```

- [ ] **Step 3: Update the clone step to use feature/tinacms-authjs branch**

In the same `deploy.yml`, change the branch in the clone step:

```yaml
git clone https://github.com/masidawoud/autosite.git \
  --branch feature/tinacms-authjs \
```

- [ ] **Step 4: Set the new GitHub Actions variable**

In `demo-tandarts` repo → Settings → Secrets and variables → Variables:
- Remove `TINA_CLIENT_ID` (if present)
- Add `TINA_CONTENT_API_URL` = `https://tina-backend-demo.fly.dev`

Remove the `TINA_TOKEN` secret if present (no longer needed).

- [ ] **Step 5: Trigger a test build**

Push a trivial commit to `demo-tandarts/main` to trigger the action:

```bash
cd /tmp/demo-tandarts
echo "" >> config.json
git add config.json
git commit -m "chore: trigger test build after auth migration"
git push
```

Expected: GitHub Action completes successfully. The deployed site at `https://demo-tandarts.pages.dev/admin` should now show a TinaCMS login form (email/password, no GitHub OAuth).

---

## Task 8: Validate email/password login end-to-end

**This is the Phase 1 acceptance test for the auth migration.**

- [ ] **Step 1: Open admin on deployed site**

Navigate to `https://demo-tandarts.pages.dev/admin`.

Expected: TinaCMS admin loads and shows a **username/password login form** — NOT a GitHub OAuth button. This confirms Tina Cloud is no longer used.

- [ ] **Step 2: Log in with seeded credentials**

Username: `admin`
Password: `admin`

Expected: Login succeeds and you are prompted to change the default password. Change it to something secure.

- [ ] **Step 3: Make a test edit**

Edit `business.name` (change to "Test Praktijk") → Save.

Expected: TinaCMS sends the change to the Fly.io backend → backend commits to `demo-tandarts/src/data/site.json` via GitHub API.

- [ ] **Step 4: Verify the commit landed in the demo repo**

On GitHub: `demo-tandarts` repo → commits. Expected: a new commit modifying `src/data/site.json` with the new business name.

- [ ] **Step 5: Verify GitHub Action re-fired**

On GitHub Actions: a new "Build and Deploy" run triggered by the TinaCMS commit. Let it complete.

- [ ] **Step 6: Verify deployed site reflects the edit**

Reload `https://demo-tandarts.pages.dev`. Expected: site shows "Test Praktijk" in the nav/contact/footer.

**Auth migration is validated when Step 6 passes.**

- [ ] **Step 7: Revert test edit**

Log back in to the admin → change `business.name` back to the original value → Save.

---

## Task 9: Final commit

- [ ] **Step 1: Verify all changes are committed**

```bash
cd /Users/masidawoud/Dev/autosite
git status
```

Expected: working tree clean.

- [ ] **Step 2: Push branch**

```bash
git push -u origin feature/tinacms-authjs
```

- [ ] **Step 3: Do NOT merge to main**

Leave `feature/tinacms-authjs` as a validated spike. Merging to main is a separate decision.

---

## Troubleshooting

### TinaNodeBackend API mismatch
If `TinaNodeBackend` doesn't accept `(req, res)` as Express middleware, check the `@tinacms/datalayer` source or docs. Alternative: use `createLocalDatabase` for testing first to confirm the schema/config is correct before debugging the backend API.

### next-auth outside Next.js (HIGH PROBABILITY BLOCKER)

`AuthJsBackendAuthProvider` internally calls `NextAuth(authOptions)(req, res)` and uses `getServerSession(req, res, authOptions)`. Both expect Next.js-extended request objects with `req.query.nextauth` populated by Next.js's router. A plain Express request does not have this. Symptoms: auth routes (`/api/tina/auth/*`) return 404, 500, or silently fail.

**Fallback: Custom JWT auth (likely needed — implement this if Task 4 Step 4 smoke test fails)**

1. Remove `tinacms-authjs` and `next-auth` from `tina-backend/package.json`. Add `jsonwebtoken` and `bcryptjs`.
2. Replace `auth.ts` with a `BackendAuthProvider` that validates a JWT from `Authorization: Bearer <token>`:
   ```typescript
   import jwt from "jsonwebtoken";
   export const customBackendAuth = {
     isAuthorized: async (req: any) => {
       const token = req.headers.authorization?.replace("Bearer ", "");
       if (!token) return { isAuthorized: false };
       try {
         jwt.verify(token, process.env.JWT_SECRET!);
         return { isAuthorized: true };
       } catch {
         return { isAuthorized: false };
       }
     },
   };
   ```
3. Add `POST /api/auth/login` to `index.ts`: read credentials from request body, compare against `content/users/index.json` using `bcryptjs`, return a signed JWT on success.
4. In `dental-template/tina/config.ts`, replace `UsernamePasswordAuthJSProvider` with `CustomAuthProvider extends AbstractAuthProvider` that:
   - In `authenticate()`: redirects to a simple HTML login page at `/admin/login.html`
   - In `getToken()`: returns `{ id_token: localStorage.getItem("tina_token") }`
   - In `getUser()`: calls `GET /api/auth/me` with the stored token
   - In `logout()`: clears the token and redirects to the login page
5. Build the login page as a static HTML file in `dental-template/public/admin/login.html`.

Full reference: `https://tina.io/docs/reference/self-hosted/auth-provider/bring-your-own`

This approach adds ~80 lines of custom code but is fully framework-independent and has zero risk of Next.js runtime assumptions.

### Upstash Redis free tier limits
10,000 commands/day on the free tier. Each content load/save uses ~5-10 commands. For a spike with one client, this is not a concern.

### Fly.io cold starts
With `auto_stop_machines = true`, the first request after idle takes ~2-3 seconds. This only affects the admin panel, not the static site. Acceptable for a spike; set `min_machines_running = 1` to eliminate if it's annoying during testing.

### CORS issues
If the admin panel (served from `*.pages.dev`) gets CORS errors hitting the Fly.io backend, verify the `cors()` middleware in `index.ts` is mounted before all routes and that `credentials: true` is set.

---

## Exit Criteria

| Check | Expected |
|-------|----------|
| Local `npm run dev` (TINA_PUBLIC_IS_LOCAL=true) | TinaCMS local admin starts, schema loads, no Tina Cloud calls |
| `npm run build` (TINA_PUBLIC_IS_LOCAL=false, TINA_CONTENT_API_URL set) | Admin bundle built pointing to Fly.io backend |
| Fly.io health check | `GET /health` returns 200 |
| `/admin` on deployed site | Shows email/password login form (not GitHub OAuth) |
| Login with admin/admin | Succeeds, prompted to change password |
| Save edit in admin | Commit appears in demo-tandarts repo within ~5s |
| GitHub Action re-triggers | Build + deploy completes after TinaCMS commit |
| Deployed site reflects edit | Change visible within ~3 min of saving |
