# AutoSite — Full CMS Integration Design

**Date:** 2026-03-22
**Type:** Feature spec
**Status:** Approved
**Stack:** Astro 4.x · Sveltia CMS · Self-hosted Gitea (Hetzner VPS) · Cloudflare Pages

---

## Overview

This spec defines the full production CMS integration for AutoSite dental client sites. It covers:

1. Complete data model — all content files, operator/client split, new section files
2. Dynamic section renderer in `index.astro` with multi-page extension point
3. Six new Astro section components (FAQ, Gallery, Before/After, Map, Emergency Banner, Pricing)
4. `Nav.astro` and `Footer.astro` updated to render dynamic content from `site.json`
5. Full `admin/config.yml` field definitions — complete Sveltia CMS configuration
6. Provisioning changes to `build-sites.js`

**Scope boundary:** Home page only (single `index.astro`). Architecture is designed from the start to extend to multiple pages without structural rework. Theme editing (colors, fonts) is operator-only — not exposed in the CMS.

---

## Data Architecture

### Hybrid model: core in `site.json`, optional sections in separate files

`site.json` keeps all existing fields unchanged. Six new JSON files are added to `dental-template/src/data/` — one per optional section. This preserves the current structure while making new sections self-contained and independently extensible.

```
dental-template/src/data/
  site.json           ← existing fields + nav + footer.social + contact_form
  theme.json          ← operator-only, not touched by this spec
  sections.json       ← page-scoped section order + visibility
  faq.json            ← FAQ section content
  gallery.json        ← Gallery section content
  before_after.json   ← Before/After section content
  map.json            ← Map embed section content
  emergency.json      ← Emergency Banner content + enabled flag
  pricing.json        ← Pricing section content
  themes/             ← unchanged
```

### `sections.json` — page-scoped from day one

Page-scoped structure is used from the start so extending to multiple pages requires no data migration:

```json
{
  "pages": {
    "home": [
      { "id": "hero",         "enabled": true  },
      { "id": "quote",        "enabled": true  },
      { "id": "features",     "enabled": true  },
      { "id": "services",     "enabled": true  },
      { "id": "team",         "enabled": true  },
      { "id": "reviews",      "enabled": true  },
      { "id": "hours",        "enabled": true  },
      { "id": "vergoeding",   "enabled": true  },
      { "id": "contact",      "enabled": true  },
      { "id": "faq",          "enabled": false },
      { "id": "gallery",      "enabled": false },
      { "id": "before_after", "enabled": false },
      { "id": "map",          "enabled": false },
      { "id": "pricing",      "enabled": false }
    ]
  }
}
```

**`emergency` is not in `sections.json`.** The Emergency Banner is controlled exclusively by `emergency.json.enabled` — see EmergencyBanner section below. Existing sections default to `enabled: true`. New sections default to `enabled: false` — clients activate them once content is filled in.

Nav and Footer are **never** in `sections.json` — they render unconditionally in `Layout.astro`.

When the multi-page spec ships, additional page keys are added under `pages`: `{ "home": [...], "about": [...] }`. No structural migration needed.

### New fields added to `site.json`

Three new top-level keys are added to `site.json` during provisioning:

```json
"nav": {
  "links": [
    { "label": "Diensten", "href": "#services" },
    { "label": "Team",     "href": "#team" },
    { "label": "Contact",  "href": "#contact" }
  ]
},
"footer": {
  "tagline": "Tandheelkunde die goed voelt.",
  "social": [
    { "platform": "facebook",  "url": "" },
    { "platform": "instagram", "url": "" }
  ]
},
"contact_form": {
  "recipient_email": "info@praktijk.nl",
  "confirmation_message": "Bedankt! Wij nemen binnen één werkdag contact op."
}
```

`recipient_email` and `confirmation_message` are client-editable and live in the client repo.

**`worker_url` is not stored in `site.json` in the client repo.** It is injected at build time by the deploy workflow from a Gitea Actions variable (`FORMS_WORKER_URL`), using `jq` to add it to `site.json` before the Astro build runs. This prevents it from being silently dropped when Sveltia saves the file. `build-sites.js` does not need to write it during provisioning.

---

## Operator / Client Field Split

### Client-editable (exposed in Sveltia CMS)

| Section | File | Editable fields |
|---|---|---|
| Business Info | `site.json` | Name, address, postal code, city, phone, email |
| Navigation | `site.json` | Menu links (label + href) |
| Hero | `site.json` | Eyebrow, headline, description, CTA labels, image URL |
| Quote | `site.json` | Quote text, author name, author role |
| Features | `site.json` | Eyebrow, title, subtitle, image URL, feature items (icon, title, desc) |
| Services | `site.json` | Eyebrow, title, subtitle, service items (tag, title, desc, image, bullets, CTA) |
| Team | `site.json` | Eyebrow, title, subtitle, team members (name, role, bio, photo) |
| Reviews | `site.json` | Title, subtitle, review items (name, stars, date, text) |
| Opening Hours | `site.json` | Per-day: time string + open/closed toggle |
| Vergoeding | `site.json` | Eyebrow, title, intro, text blocks (title + text), insurer list, CTA label |
| Contact | `site.json` | Eyebrow, title, intro |
| Contact Form | `site.json` | Recipient email, confirmation message |
| Footer | `site.json` | Tagline, social links (platform + URL) |
| Homepage Sections | `sections.json` | Order (arrow handles) + enable/disable per section |
| FAQ | `faq.json` | Eyebrow, title, Q&A pairs (question + answer) |
| Gallery | `gallery.json` | Eyebrow, title, photos (image URL + caption) |
| Before/After | `before_after.json` | Eyebrow, title, pairs (before URL, after URL, description) |
| Map | `map.json` | Title, embed URL, label |
| Emergency Banner | `emergency.json` | Text, phone, enabled toggle |
| Pricing | `pricing.json` | Eyebrow, title, disclaimer, rows (treatment, price, notes) |

### Operator-only (never in `config.yml`)

- `meta.title`, `meta.description`
- `business.google_reviews_score`, `business.google_reviews_count`, `business.google_reviews_url`
- `contact_form.worker_url`
- `theme.json` (all fields)

---

## Astro Template Changes

### `Nav.astro` — refactored for dynamic links

`Nav.astro` currently hardcodes navigation links. It must be updated to accept a `nav` prop and render links from data:

```astro
interface Props {
  business: { name: string; phone: string; };
  nav: { links: Array<{ label: string; href: string; }> };
}
```

The hardcoded `<a>` tags in the nav are replaced with a loop over `nav.links`.

### `Footer.astro` — updated for social links

`Footer.astro` currently accepts `{ business, footer }` where `footer` only has `tagline`. It must be updated to render the new `footer.social` array:

```astro
footer: {
  tagline: string;
  social: Array<{ platform: string; url: string; }>;
}
```

Social links render as icon links in the footer. Empty `url` values are skipped (not rendered).

### `index.astro` — dynamic section renderer

`index.astro` is refactored from a hardcoded component list to a data-driven renderer:

```astro
---
import sectionsData from '../data/sections.json';
import faq from '../data/faq.json';
import gallery from '../data/gallery.json';
import beforeAfter from '../data/before_after.json';
import map from '../data/map.json';
import emergency from '../data/emergency.json';
import pricing from '../data/pricing.json';
// ... existing imports

const homeSections = sectionsData.pages.home;

const SECTION_MAP = {
  hero:         () => <Hero data={site.hero} business={site.business} />,
  quote:        () => <Quote data={site.quote} />,
  features:     () => <Features data={site.features} />,
  services:     () => <Services data={site.services} />,
  team:         () => <About data={site.team} />,
  reviews:      () => <Reviews data={site.reviews} />,
  hours:        () => <OpeningHours data={site.hours} business={site.business} />,
  vergoeding:   () => <Vergoeding data={site.vergoeding} />,
  contact:      () => <Contact data={site.contact} business={site.business} contactForm={site.contact_form} projectName={site.project_name} />,
  faq:          () => <FAQ data={faq} />,
  gallery:      () => <Gallery data={gallery} />,
  before_after: () => <BeforeAfter data={beforeAfter} />,
  map:          () => <Map data={map} />,
  pricing:      () => <Pricing data={pricing} />,
};
---

<Layout title={site.meta.title} description={site.meta.description}>
  <Nav business={site.business} nav={site.nav} />
  {emergency.enabled && <EmergencyBanner data={emergency} />}
  <main>
    {homeSections
      .filter(s => s.enabled)
      .map(s => SECTION_MAP[s.id]?.())
    }
  </main>
  <Footer business={site.business} footer={site.footer} />
</Layout>
```

### `EmergencyBanner` — controlled by `emergency.json` only

The Emergency Banner renders outside the sections loop, above `<main>`, via sticky positioning. Visibility is controlled **solely** by `emergency.json.enabled`. The banner is not in `sections.json` — this avoids a dual-flag model where two values must agree. The CMS exposes `emergency.json` directly under "Optionele secties → Spoedmelding".

### Multi-page extension point

**Superseded by `2026-03-22-new-pages-design.md`.** Client-created pages are served by `src/pages/[slug].astro` as Markdown content pages. `sections.json` remains page-scoped for future extensibility, but the `[slug].astro` route now belongs to the new-pages spec. If section-based multi-page support is ever needed, it will be a separate spec that extends that route.

---

## New Astro Components

Six new components added to `dental-template/src/components/`. All follow the existing pattern: typed props, no hardcoded copy, CSS custom properties for theming.

| Component | File | UI pattern | Key fields |
|---|---|---|---|
| `FAQ.astro` | `faq.json` | Accordion | `eyebrow`, `title`, `items[]` (question, answer) |
| `Gallery.astro` | `gallery.json` | Responsive grid | `eyebrow`, `title`, `items[]` (image_url, caption) |
| `BeforeAfter.astro` | `before_after.json` | Side-by-side pairs | `eyebrow`, `title`, `items[]` (before_url, after_url, description) |
| `Map.astro` | `map.json` | iframe with overlay | `title`, `embed_url`, `label` |
| `EmergencyBanner.astro` | `emergency.json` | Sticky high-contrast banner | `text`, `phone`, `enabled` |
| `Pricing.astro` | `pricing.json` | Card/table layout | `eyebrow`, `title`, `disclaimer`, `items[]` (treatment, price, notes) |

All six ship with Dutch-language placeholder content.

---

## Sveltia CMS Configuration (`admin/config.yml`)

### Critical implementation note — single file collection for `site.json`

All client-editable fields from `site.json` are defined in **one single file collection entry**. Using multiple file collection entries pointing at the same file risks data loss on save (last write wins if Sveltia does not deep-merge partial edits). A single entry writes the complete file on every save, which is safe and correct.

The `config.yml` is generated during provisioning from a template.

```yaml
backend:
  name: gitea
  repo: operator/client-{id}
  base_url: https://gitea.autosite.nl
  api_root: https://gitea.autosite.nl/api/v1
  app_id: <operator-oauth-app-client-id>

media_folder: public/images
public_folder: /images

collections:

  # ─── Site content (single entry — all site.json fields) ───────────────────
  - name: site
    label: Site-inhoud
    files:
      - name: site
        label: Site-inhoud
        file: site.json
        fields:
          - name: business
            label: Praktijkgegevens
            widget: object
            fields:
              - { name: name,        label: Praktijknaam,   widget: string }
              - { name: address,     label: Adres,          widget: string }
              - { name: postal_code, label: Postcode,       widget: string }
              - { name: city,        label: Stad,           widget: string }
              - { name: phone,       label: Telefoonnummer, widget: string }
              - { name: email,       label: E-mailadres,    widget: string }

          - name: nav
            label: Navigatie
            widget: object
            fields:
              - name: links
                label: Menupunten
                widget: list
                fields:
                  - { name: label, label: Label, widget: string }
                  - { name: href,  label: Link,  widget: string }

          - name: hero
            label: Hero
            widget: object
            fields:
              - { name: eyebrow,       label: Eyebrow,         widget: string }
              - { name: headline,      label: Koptekst,        widget: string }
              - { name: description,   label: Omschrijving,    widget: text   }
              - { name: cta_primary,   label: Knop primair,    widget: string }
              - { name: cta_secondary, label: Knop secundair,  widget: string }
              - { name: image_url,     label: Afbeelding URL,  widget: string }

          - name: quote
            label: Quote
            widget: object
            fields:
              - { name: text,        label: Tekst,       widget: text   }
              - { name: author_name, label: Naam,        widget: string }
              - { name: author_role, label: Functie,     widget: string }

          - name: features
            label: Kenmerken
            widget: object
            fields:
              - { name: eyebrow,   label: Eyebrow,    widget: string }
              - { name: title,     label: Titel,      widget: string }
              - { name: subtitle,  label: Subtitel,   widget: string }
              - { name: image_url, label: Afbeelding, widget: string }
              - name: items
                label: Kenmerken
                widget: list
                fields:
                  - { name: icon,  label: Icoon,        widget: string }
                  - { name: title, label: Titel,        widget: string }
                  - { name: desc,  label: Omschrijving, widget: text   }

          - name: services
            label: Diensten
            widget: object
            fields:
              - { name: eyebrow,  label: Eyebrow,  widget: string }
              - { name: title,    label: Titel,    widget: string }
              - { name: subtitle, label: Subtitel, widget: string }
              - name: items
                label: Diensten
                widget: list
                fields:
                  - { name: tag,       label: Label,        widget: string }
                  - { name: title,     label: Titel,        widget: string }
                  - { name: desc,      label: Omschrijving, widget: text   }
                  - { name: image_url, label: Afbeelding,   widget: string }
                  - { name: items,     label: Bullets,      widget: list, field: { name: item, widget: string } }
                  - { name: cta,       label: Knoptekst,    widget: string }

          - name: team
            label: Team
            widget: object
            fields:
              - { name: eyebrow,  label: Eyebrow,  widget: string }
              - { name: title,    label: Titel,    widget: string }
              - { name: subtitle, label: Subtitel, widget: string }
              - name: members
                label: Teamleden
                widget: list
                fields:
                  - { name: name,      label: Naam,     widget: string }
                  - { name: role,      label: Functie,  widget: string }
                  - { name: bio,       label: Bio,      widget: text   }
                  - { name: image_url, label: Foto URL, widget: string }

          - name: reviews
            label: Reviews
            widget: object
            fields:
              - { name: title,    label: Titel,    widget: string }
              - { name: subtitle, label: Subtitel, widget: string }
              - name: items
                label: Reviews
                widget: list
                fields:
                  - { name: name,  label: Naam,    widget: string }
                  - { name: stars, label: Sterren, widget: number, min: 1, max: 5 }
                  - { name: date,  label: Datum,   widget: string }
                  - { name: text,  label: Tekst,   widget: text   }

          - name: hours
            label: Openingstijden
            widget: object
            fields:
              - name: items
                label: Dagen
                widget: list
                fields:
                  - { name: day,  label: Dag,  widget: string }
                  - { name: time, label: Tijd, widget: string }
                  - { name: open, label: Open, widget: boolean }

          - name: vergoeding
            label: Vergoeding
            widget: object
            fields:
              - { name: eyebrow, label: Eyebrow, widget: string }
              - { name: title,   label: Titel,   widget: string }
              - { name: intro,   label: Intro,   widget: text   }
              - name: blocks
                label: Tekstblokken
                widget: list
                fields:
                  - { name: title, label: Titel, widget: string }
                  - { name: text,  label: Tekst, widget: text   }
              - name: insurers
                label: Verzekeraars
                widget: list
                field: { name: name, widget: string }
              - { name: cta, label: CTA-tekst, widget: string }

          - name: contact
            label: Contact
            widget: object
            fields:
              - { name: eyebrow, label: Eyebrow,      widget: string }
              - { name: title,   label: Titel,        widget: string }
              - { name: intro,   label: Omschrijving, widget: text   }

          - name: contact_form
            label: Contactformulier
            widget: object
            fields:
              - { name: recipient_email,      label: Ontvanger e-mail,    widget: string }
              - { name: confirmation_message, label: Bevestigingsbericht, widget: string }

          - name: footer
            label: Footer
            widget: object
            fields:
              - { name: tagline, label: Tagline, widget: string }
              - name: social
                label: Sociale media
                widget: list
                fields:
                  - name: platform
                    label: Platform
                    widget: select
                    options: [facebook, instagram, linkedin, twitter, youtube]
                  - { name: url, label: URL, widget: string }

  # ─── Sections order & visibility ──────────────────────────────────────────
  - name: sections
    label: Secties
    files:
      - name: sections
        label: Sectievolgorde & zichtbaarheid
        file: sections.json
        fields:
          - name: pages
            label: Pagina's
            widget: object
            fields:
              - name: home
                label: Homepagina
                widget: list
                fields:
                  - name: id
                    label: Sectie-ID
                    widget: string
                    # Implementation note: id values must not be changed by clients.
                    # Validate during implementation whether Sveltia supports a
                    # read-only display for list item fields. If not, simplify this
                    # panel to a fixed set of boolean fields (one per section) rather
                    # than a reorderable list. Reordering via arrow handles is the
                    # primary UX goal; id integrity is non-negotiable.
                  - { name: enabled, label: Actief, widget: boolean }

  # ─── Optional sections (own files) ────────────────────────────────────────
  - name: optional_sections
    label: Optionele secties
    files:
      - name: faq
        label: FAQ
        file: faq.json
        fields:
          - { name: eyebrow, label: Eyebrow, widget: string }
          - { name: title,   label: Titel,   widget: string }
          - name: items
            label: Vragen
            widget: list
            fields:
              - { name: question, label: Vraag,    widget: string }
              - { name: answer,   label: Antwoord, widget: text   }

      - name: gallery
        label: Galerij
        file: gallery.json
        fields:
          - { name: eyebrow, label: Eyebrow, widget: string }
          - { name: title,   label: Titel,   widget: string }
          - name: items
            label: Foto's
            widget: list
            fields:
              - { name: image_url, label: Afbeelding, widget: string }
              - { name: caption,   label: Bijschrift,  widget: string }

      - name: before_after
        label: Voor & Na
        file: before_after.json
        fields:
          - { name: eyebrow, label: Eyebrow, widget: string }
          - { name: title,   label: Titel,   widget: string }
          - name: items
            label: Resultaten
            widget: list
            fields:
              - { name: before_url,  label: Voor-foto,    widget: string }
              - { name: after_url,   label: Na-foto,      widget: string }
              - { name: description, label: Omschrijving, widget: text   }

      - name: map
        label: Kaart
        file: map.json
        fields:
          - { name: title,     label: Titel,      widget: string }
          - { name: embed_url, label: Embed URL,  widget: string }
          - { name: label,     label: Adreslabel, widget: string }

      - name: emergency
        label: Spoedmelding
        file: emergency.json
        fields:
          - { name: text,    label: Tekst,     widget: string }
          - { name: phone,   label: Telefoon,  widget: string }
          - { name: enabled, label: Zichtbaar, widget: boolean }

      - name: pricing
        label: Tarieven
        file: pricing.json
        fields:
          - { name: eyebrow,    label: Eyebrow,    widget: string }
          - { name: title,      label: Titel,      widget: string }
          - { name: disclaimer, label: Disclaimer, widget: string }
          - name: items
            label: Behandelingen
            widget: list
            fields:
              - { name: treatment, label: Behandeling, widget: string }
              - { name: price,     label: Tarief,      widget: string }
              - { name: notes,     label: Opmerkingen, widget: string }
```

---

## Provisioning Changes (`build-sites.js`)

### Gitea Actions variable

`FORMS_WORKER_URL` — set once as a Gitea Actions variable on the operator account (not a per-client secret). The deploy workflow injects it into `site.json` at build time using `jq` before `astro build` runs. It never lives in the client's committed `site.json`.

### New `prospects.csv` column

`form_recipient_email` — if blank, defaults to the `email` column.

### New files pushed to each client repo at provisioning

```
sections.json       ← page-scoped, all existing sections enabled, new ones disabled
faq.json            ← Dutch placeholder Q&A pairs
gallery.json        ← Dutch placeholder photo entries
before_after.json   ← Dutch placeholder image pairs
emergency.json      ← Dutch placeholder, enabled: false
pricing.json        ← Dutch placeholder treatment rows
map.json            ← placeholder embed URL (operator fills per client)
```

### Updated `deploy.yml` inject step

```yaml
- name: Inject client content
  run: |
    cp site.json theme.json sections.json template/src/data/
    cp faq.json gallery.json before_after.json \
       map.json emergency.json pricing.json template/src/data/
    cp admin/config.yml template/public/admin/config.yml

- name: Inject operator config
  run: |
    jq --arg url "$FORMS_WORKER_URL" \
      '.contact_form.worker_url = $url' \
      template/src/data/site.json > /tmp/site.json && \
      mv /tmp/site.json template/src/data/site.json
  env:
    FORMS_WORKER_URL: ${{ vars.FORMS_WORKER_URL }}
```

---

## Open Questions

| Question | Impact | Resolution |
|---|---|---|
| Sveltia list widget — `id` field read-only | If `id` is freely editable, clients can corrupt `sections.json`. Validate whether Sveltia supports a display-only field in list items; if not, replace the reorderable list with a fixed set of boolean fields per section | Validate during implementation before shipping the sections CMS panel |
| Google Maps embed URL per client | Requires a Maps API key — operator must generate per client | Document as manual onboarding step; OpenStreetMap is a zero-config alternative |
| Placeholder content language | All new section JSON files must use Dutch copy | Confirm during implementation |
