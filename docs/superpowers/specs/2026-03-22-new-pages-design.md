# AutoSite — New Pages Design

**Date:** 2026-03-22
**Type:** Feature spec
**Status:** Approved
**Stack:** Astro 4.x · Sveltia CMS · Self-hosted Gitea · Cloudflare Pages

---

## Overview

This spec defines client-created pages for AutoSite dental sites. Clients can create, edit, and delete additional pages (e.g. `/over-ons`, `/team`, `/privacy`) via the CMS without operator involvement. Pages use a simple fixed layout: Nav + rich text body + Footer.

**Scope:** Flat slugs only (`/slug`) — one level deep. Nested routes (`/diensten/implantaten`) are deferred to a future spec. Home page (`/`) is unchanged and uses the existing section-based model.

**Relationship to CMS spec multi-page extension point:** The CMS integration spec (`2026-03-22-cms-full-integration-design.md`) describes a future `[slug].astro` that reads from `sectionsData.pages[slug]` and renders section-based pages. **This spec supersedes that extension point.** `[slug].astro` now serves Markdown content pages (this spec). If section-based multi-page support is ever needed, it will be a separate spec that extends or replaces this route. The CMS spec's extension point description is superseded — do not implement both simultaneously.

---

## Data Model

### Client repo structure

Pages live in a `pages/` folder in the client repo. Each page is a Markdown file:

```
client-repo/
  site.json
  sections.json
  pages/
    over-ons.md
    team.md
    privacy.md
  admin/config.yml
  .gitea/workflows/deploy.yml
```

### Page file format

```markdown
---
title: Over ons
meta_title: Over ons — Tandartspraktijk De Glimlach
meta_description: Lees meer over onze praktijk en ons team in Amsterdam.
published: true
---

Wij zijn een moderne tandartspraktijk in het hart van Amsterdam...
```

**No `slug` field in frontmatter.** The URL slug is derived from the filename (`over-ons.md` → `/over-ons`). Sveltia generates the filename from the page title using its `slug` pattern — clients never type a slug manually. This prevents frontmatter slug values from silently diverging from the actual URL.

`published: false` removes the page from `getStaticPaths()` — no route is generated, no URL exists. The field is labelled "Pagina zichtbaar op de website" in Dutch to avoid confusion for non-technical clients.

---

## Astro Content Collection

### `dental-template/src/content/config.ts`

```ts
import { defineCollection, z } from 'astro:content';

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    meta_title: z.string().default(''),
    meta_description: z.string().default(''),
    published: z.boolean().default(true),
  }),
});

export const collections = { pages };
```

`meta_title` and `meta_description` use `.default('')` so a client who saves without filling them in does not cause a build failure. `[slug].astro` falls back to the page `title` when `meta_title` is empty.

No `slug` in schema — Astro derives it from the filename automatically via `entry.slug`. The collection must never contain subdirectories — flat files only. If a subdirectory were present, `entry.slug` would include a path separator and the slug validator would correctly reject it.

---

## Dynamic Route — `src/pages/[slug].astro`

```astro
---
import { getCollection } from 'astro:content';
import Layout from '../layouts/Layout.astro';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
import site from '../data/site.json';

const RESERVED_SLUGS = ['index', 'contact', 'diensten', '404', 'admin'];

export async function getStaticPaths() {
  const pages = await getCollection('pages', ({ data }) => data.published);

  for (const page of pages) {
    if (RESERVED_SLUGS.includes(page.slug)) {
      throw new Error(
        `Ongeldige paginanaam: "${page.slug}" is gereserveerd. Kies een andere naam.`
      );
    }
    if (!/^[a-z0-9-]+$/.test(page.slug)) {
      throw new Error(
        `Ongeldige paginanaam: "${page.slug}" mag alleen kleine letters, cijfers en koppeltekens bevatten.`
      );
    }
  }

  return pages.map(entry => ({
    params: { slug: entry.slug },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content } = await entry.render();
const metaTitle = entry.data.meta_title || entry.data.title;
const metaDesc = entry.data.meta_description;
---

<Layout title={metaTitle} description={metaDesc}>
  <Nav business={site.business} nav={site.nav} />
  <main class="page-content">
    <div class="container">
      <h1 class="page-content__title">{entry.data.title}</h1>
      <div class="prose">
        <Content />
      </div>
    </div>
  </main>
  <Footer business={site.business} footer={site.footer} />
</Layout>
```

**Slug validation runs at build time.** If a client creates a page with a reserved or invalid slug, the deploy workflow fails with a Dutch error message in the build log. The previous deploy remains live.

**Note:** Astro may wrap `getStaticPaths` errors in its own error boundary, which can obscure the Dutch message. Verify during implementation that the error text is legible in the Gitea Actions log; if not, log it explicitly before throwing.

---

## `.prose` CSS

`dental-template/src/layouts/Layout.astro` (or a shared global stylesheet) must define `.prose` styles for Markdown-rendered HTML. Minimum required ruleset:

```css
.prose { max-width: 72ch; }
.prose h1, .prose h2, .prose h3 { font-family: var(--font-display); margin-block: 1.5em 0.5em; }
.prose p { line-height: 1.75; margin-block: 1em; }
.prose ul, .prose ol { padding-inline-start: 1.5em; margin-block: 1em; }
.prose li { margin-block: 0.375em; }
.prose a { color: var(--color-accent); text-decoration: underline; text-underline-offset: 3px; }
.prose strong { font-weight: 600; }
```

Exact values follow the existing CSS custom property system (`--font-display`, `--color-accent`, etc.).

---

## Sveltia CMS Configuration

Pages collection added to `admin/config.yml`:

```yaml
- name: pages
  label: Pagina's
  label_singular: Pagina
  folder: pages
  create: true
  delete: true
  slug: '{{slug}}'
  extension: md
  format: frontmatter
  fields:
    - { name: title,            label: Paginatitel,                    widget: string  }
    - { name: meta_title,       label: SEO-titel,                      widget: string, required: false }
    - { name: meta_description, label: SEO-omschrijving,               widget: text,   required: false }
    - name: published
      label: Pagina zichtbaar op de website
      widget: boolean
      default: true
    - { name: body,             label: Inhoud,                         widget: markdown }
```

`slug: '{{slug}}'` instructs Sveltia to generate the filename from the page title. Sveltia normalises spaces to hyphens and lowercases — verify during implementation that Dutch diacritics (é, ij, ë) are also handled correctly (see Open Questions).

**Nav links are manual.** After creating a page, clients add a nav link via the Navigation section in the CMS (`site.json` → `nav.links`). They enter the href as `/over-ons` to match the page URL.

---

## Deploy Workflow Changes

The complete updated step sequence in `.gitea/workflows/deploy.yml` (relevant portion):

```yaml
- name: Inject client content
  run: |
    cp site.json theme.json sections.json template/src/data/
    cp faq.json gallery.json before_after.json \
       map.json emergency.json pricing.json template/src/data/
    cp admin/config.yml template/public/admin/config.yml

- name: Inject client pages
  run: |
    mkdir -p template/src/content/pages
    if compgen -G "pages/*.md" > /dev/null 2>&1; then
      cp pages/*.md template/src/content/pages/
    fi

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

- name: Build
  working-directory: template
  run: npm ci && npm run build

- name: Deploy
  working-directory: template
  run: npx wrangler@3 pages deploy dist --project-name=${{ secrets.CF_PROJECT_NAME }}
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

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

`mkdir -p template/src/content/pages` runs unconditionally — Astro 4.x throws a build error if a `defineCollection` directory does not exist. The conditional `cp` runs only when `.md` files are present.

---

## Open Questions

| Question | Impact | Resolution |
|---|---|---|
| Sveltia `{{slug}}` Dutch normalisation | Does Sveltia convert spaces to hyphens AND strip diacritics (é → e, ij → ij) from titles when generating filenames? If not, filenames contain spaces or non-ASCII chars and the slug validator will reject the build | Validate with a test page during implementation before shipping |
| `getStaticPaths` error visibility | Astro may wrap thrown errors in its own boundary, hiding the Dutch message | Verify in the Actions log during implementation; add explicit `console.error` before throw if needed |
| `RESERVED_SLUGS` maintenance | Must stay in sync with all `src/pages/*.astro` static files in `dental-template` | Update the blocklist whenever a new static route is added to the template |
