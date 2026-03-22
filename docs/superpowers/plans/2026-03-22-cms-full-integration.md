# Full CMS Integration Implementation Plan

**STATUS: IN REVIEW** — Implementation complete but architecture diverged significantly from original plan. User is testing locally and providing UX feedback. More changes expected.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend dental-template with 6 new section components, dynamic section rendering, client-editable Nav/Footer, full Sveltia CMS config.yml, and build-sites.js provisioning for all new data files.

**Spec:** `docs/superpowers/specs/2026-03-22-cms-full-integration-design.md`

---

## Architecture as implemented (diverged from original plan)

The original plan used `sections.json` + separate JSON files per section. The actual implementation uses a different, cleaner architecture:

- **All page content** lives in `src/content/pages/*.md` with JSON frontmatter (Astro content collections)
- **Config split** into 5 separate files: `business.json`, `nav.json`, `contact_form.json`, `footer.json`, `emergency.json`
- **CMS has 2 collections:** Instellingen (5 file entries) + Pagina's (folder, create:true, delete:false)
- **Every page** shares the same schema: sections (14 typed types incl. richtext) + SEO fields
- **Nav links** use typed list (Pagina relation widget OR Aangepaste URL)
- **Richtext** is a section type (Tekstblok), not a default page field
- `index.astro` reads home via `getEntry('pages', 'home')`; `[slug].astro` renders all other pages
- `build-sites.js` writes 5 config files + `src/content/pages/home.md` with JSON frontmatter

## Open questions from review

1. **Deploy button** — every CMS save = Gitea commit = CF Pages deploy. User wants to batch edits and deploy once. Options:
   - `publish_mode: editorial_workflow` (Sveltia support TBD — needs investigation)
   - Custom deploy button via CF Pages API injected into admin/index.html
   - Scheduled CF Pages deploys

2. **UX feedback ongoing** — more changes expected next session

## Known CMS hacks (admin/index.html)

MutationObserver script hides:
- Bulk delete button (text === 'Delete')
- Selection checkboxes when not in entry editor (list view only)

---

## File Map

### New files
| Path | Purpose |
|---|---|
| `dental-template/src/data/sections.json` | Page-scoped section order + visibility |
| `dental-template/src/data/faq.json` | FAQ placeholder content |
| `dental-template/src/data/gallery.json` | Gallery placeholder content |
| `dental-template/src/data/before_after.json` | Before/After placeholder content |
| `dental-template/src/data/map.json` | Map embed placeholder |
| `dental-template/src/data/emergency.json` | Emergency Banner placeholder |
| `dental-template/src/data/pricing.json` | Pricing placeholder content |
| `dental-template/src/components/EmergencyBanner.astro` | Sticky high-contrast alert banner |
| `dental-template/src/components/FAQ.astro` | Accordion FAQ section |
| `dental-template/src/components/Gallery.astro` | Responsive photo grid |
| `dental-template/src/components/BeforeAfter.astro` | Side-by-side before/after pairs |
| `dental-template/src/components/Map.astro` | Google Maps iframe embed |
| `dental-template/src/components/Pricing.astro` | Treatment price table |
| `dental-template/public/admin/config.yml` | Full Sveltia CMS configuration |

### Modified files
| Path | Change |
|---|---|
| `dental-template/src/data/site.json` | Add `nav`, `footer.social`, `contact_form` top-level keys |
| `dental-template/src/pages/index.astro` | Dynamic section renderer with SECTION_MAP |
| `dental-template/src/components/Nav.astro` | Accept `nav` prop, render dynamic links |
| `dental-template/src/components/Footer.astro` | Accept `footer.social`, render social links |
| `build-sites.js` | Write new placeholder JSON files; handle `form_recipient_email` CSV column |

### Out of scope (separate plans)
- `Contact.astro` contact form worker integration — see contact-form spec
- `[slug].astro` dynamic pages — see new-pages spec
- Gitea repo creation and push — see production-provisioning spec

---

## Task 1: Create the seven placeholder data files

**Files:**
- Create: `dental-template/src/data/sections.json`
- Create: `dental-template/src/data/faq.json`
- Create: `dental-template/src/data/gallery.json`
- Create: `dental-template/src/data/before_after.json`
- Create: `dental-template/src/data/map.json`
- Create: `dental-template/src/data/emergency.json`
- Create: `dental-template/src/data/pricing.json`

- [ ] **Step 1: Create sections.json**

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

- [ ] **Step 2: Create faq.json**

```json
{
  "eyebrow": "Veelgestelde Vragen",
  "title": "Alles wat u wilt weten",
  "items": [
    {
      "question": "Hoe maak ik een afspraak?",
      "answer": "U kunt een afspraak maken via het contactformulier op onze website, door te bellen of door een e-mail te sturen. Wij reageren zo snel mogelijk."
    },
    {
      "question": "Worden mijn behandelingen vergoed?",
      "answer": "De meeste preventieve behandelingen worden vergoed vanuit de basisverzekering. Voor andere behandelingen is een aanvullende verzekering nodig. Neem contact met ons op voor meer informatie."
    },
    {
      "question": "Wat moet ik doen bij acute tandpijn?",
      "answer": "Bij acute tandpijn kunt u ons direct bellen. Wij proberen u zo snel mogelijk te helpen, ook buiten reguliere openingstijden voor spoedeisende gevallen."
    },
    {
      "question": "Hoe vaak moet ik naar de tandarts?",
      "answer": "Wij adviseren minimaal één keer per jaar een controleafspraak te maken. Afhankelijk van uw mondgezondheid kan dit vaker nodig zijn."
    }
  ]
}
```

- [ ] **Step 3: Create gallery.json**

```json
{
  "eyebrow": "Onze Praktijk",
  "title": "Welkom in onze moderne omgeving",
  "items": [
    {
      "image_url": "https://picsum.photos/seed/gallery-wachtkamer/800/600",
      "caption": "De wachtkamer"
    },
    {
      "image_url": "https://picsum.photos/seed/gallery-behandelkamer/800/600",
      "caption": "Behandelkamer"
    },
    {
      "image_url": "https://picsum.photos/seed/gallery-receptie/800/600",
      "caption": "Receptie"
    },
    {
      "image_url": "https://picsum.photos/seed/gallery-apparatuur/800/600",
      "caption": "Moderne apparatuur"
    }
  ]
}
```

- [ ] **Step 4: Create before_after.json**

```json
{
  "eyebrow": "Resultaten",
  "title": "Transformaties die spreken voor zich",
  "items": [
    {
      "before_url": "https://picsum.photos/seed/before-bleek/600/400",
      "after_url": "https://picsum.photos/seed/after-bleek/600/400",
      "description": "Tanden bleken — zichtbaar resultaat na één behandeling"
    },
    {
      "before_url": "https://picsum.photos/seed/before-kroon/600/400",
      "after_url": "https://picsum.photos/seed/after-kroon/600/400",
      "description": "Composiet restauratie — natuurlijk en sterk resultaat"
    }
  ]
}
```

- [ ] **Step 5: Create map.json**

> **Decision point:** `embed_url` is intentionally blank — operator fills it per client after provisioning. OpenStreetMap requires no API key and is a zero-config alternative to Google Maps. Leave blank for now and document as a manual step.

```json
{
  "title": "Hoe ons te vinden",
  "embed_url": "",
  "label": "Tandartspraktijk — klik voor routebeschrijving"
}
```

- [ ] **Step 6: Create emergency.json**

```json
{
  "text": "Spoedeisende tandheelkundige hulp nodig? Wij staan voor u klaar.",
  "phone": "020 123 45 67",
  "enabled": false
}
```

- [ ] **Step 7: Create pricing.json**

```json
{
  "eyebrow": "Transparante Tarieven",
  "title": "Onze behandelkosten",
  "disclaimer": "Tarieven zijn exclusief eventuele techniekkosten en kunnen afwijken. Neem contact op voor een persoonlijke offerte.",
  "items": [
    {
      "treatment": "Periodieke controle",
      "price": "€ 39,95",
      "notes": "Inclusief röntgenfoto"
    },
    {
      "treatment": "Gebitsreiniging",
      "price": "€ 55,00",
      "notes": "Per kwartier"
    },
    {
      "treatment": "Vulling (composiet)",
      "price": "€ 65,00 – € 150,00",
      "notes": "Afhankelijk van grootte"
    },
    {
      "treatment": "Tanden bleken (in-office)",
      "price": "€ 395,00",
      "notes": "Complete behandeling"
    },
    {
      "treatment": "Kroon (porseleinen)",
      "price": "€ 895,00",
      "notes": "Inclusief tandtechniek"
    }
  ]
}
```

- [ ] **Step 8: Verify all files parse correctly**

```bash
cd dental-template
for f in src/data/sections.json src/data/faq.json src/data/gallery.json \
          src/data/before_after.json src/data/map.json src/data/emergency.json \
          src/data/pricing.json; do
  python3 -m json.tool "$f" > /dev/null && echo "OK: $f"
done
```

Expected: seven `OK:` lines, no errors.

- [ ] **Step 9: Commit**

```bash
cd dental-template
git add src/data/sections.json src/data/faq.json src/data/gallery.json \
        src/data/before_after.json src/data/map.json src/data/emergency.json \
        src/data/pricing.json
git commit -m "feat: add placeholder data files for six optional sections and section order"
```

---

## Task 2: Add nav, footer.social, and contact_form fields to site.json

**Files:**
- Modify: `dental-template/src/data/site.json`

Current `site.json` has a `footer` key with only `tagline`. This task adds three new top-level keys. **Do not remove or change any existing keys.**

- [ ] **Step 1: Open site.json and locate the footer key**

The file currently has:
```json
"footer": {
  "tagline": "..."
}
```

- [ ] **Step 2: Replace the footer key and add nav + contact_form**

Change `footer` to include the new `social` array, and add `nav` and `contact_form` at the same top level. Insert after the existing `contact` key, before `footer`:

```json
"nav": {
  "links": [
    { "label": "Diensten",      "href": "#diensten"      },
    { "label": "Team",          "href": "#over-ons"      },
    { "label": "Vergoeding",    "href": "#vergoeding"    },
    { "label": "Contact",       "href": "#contact"       }
  ]
},
```

Then update the existing `footer` key:
```json
"footer": {
  "tagline": "<keep existing tagline value>",
  "social": []
},
```

Then add `contact_form` after `footer`:
```json
"contact_form": {
  "recipient_email": "",
  "confirmation_message": "Bedankt! Wij nemen binnen één werkdag contact op."
}
```

- [ ] **Step 3: Verify JSON is valid**

```bash
cd dental-template
python3 -c "
import json
s = json.load(open('src/data/site.json'))
print('nav links:', len(s['nav']['links']), '| footer.social:', isinstance(s['footer']['social'], list), '| contact_form:', 'contact_form' in s)
"
```

Expected: `nav links: 4 | footer.social: True | contact_form: True`

- [ ] **Step 4: Commit**

```bash
git add dental-template/src/data/site.json
git commit -m "feat: add nav, footer.social, contact_form fields to site.json template"
```

---

## Task 3: Update Nav.astro — accept nav prop, render dynamic links

**Files:**
- Modify: `dental-template/src/components/Nav.astro:1-8` (Props interface + destructure)
- Modify: `dental-template/src/components/Nav.astro:20-25` (desktop nav links)
- Modify: `dental-template/src/components/Nav.astro:45-48` (mobile nav links)

- [ ] **Step 1: Update the Props interface and destructure**

Replace lines 1–8:
```astro
---
interface Props {
  business: {
    name: string;
    phone: string;
  };
  nav: {
    links: Array<{ label: string; href: string }>;
  };
}
const { business, nav } = Astro.props;
---
```

- [ ] **Step 2: Replace hardcoded desktop nav links (lines 20–25)**

Replace:
```html
<nav class="nav__links" aria-label="Hoofdnavigatie">
  <a href="#diensten">Diensten</a>
  <a href="#over-ons">Over Ons</a>
  <a href="#vergoeding">Vergoeding</a>
  <a href="#contact">Contact</a>
</nav>
```

With:
```astro
<nav class="nav__links" aria-label="Hoofdnavigatie">
  {nav.links.map(link => (
    <a href={link.href}>{link.label}</a>
  ))}
</nav>
```

- [ ] **Step 3: Replace hardcoded mobile nav links (lines 45–48)**

Replace the four `<a>` tags inside `.nav__mobile` (before the CTA button):
```html
<a href="#diensten">Diensten</a>
<a href="#over-ons">Over Ons</a>
<a href="#vergoeding">Vergoeding</a>
<a href="#contact">Contact</a>
```

With:
```astro
{nav.links.map(link => (
  <a href={link.href}>{link.label}</a>
))}
```

- [ ] **Step 4: Build to catch type errors**

```bash
cd dental-template
npm run build 2>&1 | tail -20
```

Expected: build fails with a prop error because `index.astro` still passes only `business` to Nav. That's expected — Task 11 fixes index.astro. If you see Astro parse errors (not prop errors), fix those now.

> **Note:** If Astro build fails because Nav now requires `nav` prop that index.astro doesn't pass yet, add a temporary default: `const { business, nav = { links: [] } } = Astro.props;` — remove the default in Task 11 once index.astro is updated.

- [ ] **Step 5: Add temporary default to unblock build**

```astro
const { business, nav = { links: [
  { label: 'Diensten', href: '#diensten' },
  { label: 'Team', href: '#over-ons' },
  { label: 'Vergoeding', href: '#vergoeding' },
  { label: 'Contact', href: '#contact' }
] } } = Astro.props;
```

- [ ] **Step 6: Run build again — must pass**

```bash
cd dental-template
npm run build 2>&1 | tail -5
```

Expected: `build complete` or similar success output. No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add dental-template/src/components/Nav.astro
git commit -m "feat: Nav.astro accepts nav prop with dynamic links, falls back to defaults"
```

---

## Task 4: Update Footer.astro — render footer.social

**Files:**
- Modify: `dental-template/src/components/Footer.astro:1-14` (Props interface)
- Modify: `dental-template/src/components/Footer.astro` (add social links render after tagline)

Social icons use inline SVG. Only non-empty `url` values are rendered (skip blank entries).

- [ ] **Step 1: Update Props interface (lines 1–11)**

Replace:
```astro
---
interface Props {
  business: {
    name: string;
    phone: string;
    email: string;
  };
  footer: {
    tagline: string;
  };
}
const { business, footer } = Astro.props;
```

With:
```astro
---
interface Props {
  business: {
    name: string;
    phone: string;
    email: string;
  };
  footer: {
    tagline: string;
    social: Array<{ platform: string; url: string }>;
  };
}
const { business, footer } = Astro.props;
const phoneHref = business.phone.replace(/\s/g, '');
const year = new Date().getFullYear();
const socialLinks = (footer.social ?? []).filter(s => s.url);
```

- [ ] **Step 2: Add social icons map (define before the template)**

Add this helper constant after `const socialLinks`:

```astro
const SOCIAL_ICONS: Record<string, string> = {
  facebook:  '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  instagram: '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
  linkedin:  '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
  twitter:   '<path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>',
  youtube:   '<path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>',
};
```

- [ ] **Step 3: Render social links in the brand section**

In the `footer__brand` div, after the `<p class="footer__tagline">` line, add:

```astro
{socialLinks.length > 0 && (
  <div class="footer__social">
    {socialLinks.map(s => (
      <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.platform} class="footer__social-link">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" set:html={SOCIAL_ICONS[s.platform] ?? ''} />
      </a>
    ))}
  </div>
)}
```

- [ ] **Step 4: Add social styles to the `<style>` block**

Append inside `<style>`:
```css
.footer__social {
  display: flex;
  gap: 0.875rem;
  margin-top: 1.25rem;
}

.footer__social-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  background: rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  color: rgba(250, 247, 242, 0.55);
  transition: background 0.15s, color 0.15s;
}
.footer__social-link:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}
```

- [ ] **Step 5: Build — must pass**

```bash
cd dental-template
npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add dental-template/src/components/Footer.astro
git commit -m "feat: Footer.astro renders dynamic social links from footer.social array"
```

---

## Task 5: Create EmergencyBanner.astro

**Files:**
- Create: `dental-template/src/components/EmergencyBanner.astro`

Renders outside the sections loop, above `<main>`. Visibility controlled by `emergency.json.enabled` in `index.astro`, not by this component.

- [ ] **Step 1: Create the component**

```astro
---
interface Props {
  data: {
    text: string;
    phone: string;
    enabled: boolean;
  };
}
const { data } = Astro.props;
const phoneHref = data.phone.replace(/\s/g, '');
---

<div class="emergency-banner" role="alert" aria-live="assertive">
  <div class="container emergency-banner__inner">
    <svg class="emergency-banner__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
    <span class="emergency-banner__text">{data.text}</span>
    <a href={`tel:${phoneHref}`} class="emergency-banner__cta">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.1a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
      {data.phone}
    </a>
  </div>
</div>

<style>
  .emergency-banner {
    background: #b91c1c;
    color: white;
    padding-block: 0.6875rem;
    position: sticky;
    top: 0;
    z-index: 200;
  }

  .emergency-banner__inner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .emergency-banner__icon {
    flex-shrink: 0;
    opacity: 0.9;
  }

  .emergency-banner__text {
    font-size: 0.9375rem;
    font-weight: 500;
    line-height: 1.4;
  }

  .emergency-banner__cta {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.375rem 0.875rem;
    border-radius: var(--radius-sm);
    margin-left: 0.5rem;
    transition: background 0.15s;
    white-space: nowrap;
  }
  .emergency-banner__cta:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  @media (max-width: 600px) {
    .emergency-banner__inner { gap: 0.5rem; }
    .emergency-banner__cta { margin-left: 0; }
  }
</style>
```

- [ ] **Step 2: Build — must pass**

```bash
cd dental-template
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/EmergencyBanner.astro
git commit -m "feat: add EmergencyBanner component — sticky high-contrast alert with phone CTA"
```

---

## Task 6: Create FAQ.astro

**Files:**
- Create: `dental-template/src/components/FAQ.astro`

Uses native `<details>/<summary>` for zero-JS accordion. CSS handles the open/close chevron animation.

- [ ] **Step 1: Create the component**

```astro
---
interface Props {
  data: {
    eyebrow: string;
    title: string;
    items: Array<{ question: string; answer: string }>;
  };
}
const { data } = Astro.props;
---

<section class="faq section" id="faq">
  <div class="container container--narrow">
    <div class="faq__header">
      <span class="eyebrow">{data.eyebrow}</span>
      <h2>{data.title}</h2>
    </div>
    <div class="faq__list">
      {data.items.map((item, i) => (
        <details class="faq__item" open={i === 0}>
          <summary class="faq__question">
            <span>{item.question}</span>
            <svg class="faq__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </summary>
          <div class="faq__answer">
            <p>{item.answer}</p>
          </div>
        </details>
      ))}
    </div>
  </div>
</section>

<style>
  .faq__header {
    text-align: center;
    margin-bottom: clamp(2.5rem, 5vw, 3.5rem);
  }
  .faq__header h2 { margin-top: 0.5rem; }

  .faq__list {
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .faq__item {
    border-bottom: 1.5px solid var(--color-border);
  }
  .faq__item:last-child { border-bottom: none; }

  .faq__question {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.375rem 1.75rem;
    cursor: pointer;
    list-style: none;
    font-family: var(--font-display);
    font-size: 1.0625rem;
    font-weight: 500;
    color: var(--color-text);
    background: var(--color-bg);
    transition: background 0.15s;
    user-select: none;
  }
  .faq__question::-webkit-details-marker { display: none; }
  .faq__question:hover { background: var(--color-bg-alt); }

  .faq__chevron {
    flex-shrink: 0;
    color: var(--color-text-muted);
    transition: transform 0.25s ease;
  }
  details[open] .faq__chevron { transform: rotate(180deg); }

  .faq__answer {
    padding: 0 1.75rem 1.5rem;
    background: var(--color-bg);
  }
  .faq__answer p {
    font-size: 0.9375rem;
    color: var(--color-text-muted);
    line-height: 1.7;
    margin: 0;
  }
</style>
```

- [ ] **Step 2: Build — must pass**

```bash
cd dental-template && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/FAQ.astro
git commit -m "feat: add FAQ component — zero-JS details/summary accordion"
```

---

## Task 7: Create Gallery.astro

**Files:**
- Create: `dental-template/src/components/Gallery.astro`

- [ ] **Step 1: Create the component**

```astro
---
interface Props {
  data: {
    eyebrow: string;
    title: string;
    items: Array<{ image_url: string; caption: string }>;
  };
}
const { data } = Astro.props;
---

<section class="gallery section" id="galerij">
  <div class="container">
    <div class="gallery__header">
      <span class="eyebrow">{data.eyebrow}</span>
      <h2>{data.title}</h2>
    </div>
    <div class="gallery__grid">
      {data.items.map(item => (
        <figure class="gallery__item">
          <img
            src={item.image_url}
            alt={item.caption || ''}
            loading="lazy"
            decoding="async"
            class="gallery__img"
          />
          {item.caption && (
            <figcaption class="gallery__caption">{item.caption}</figcaption>
          )}
        </figure>
      ))}
    </div>
  </div>
</section>

<style>
  .gallery__header {
    text-align: center;
    margin-bottom: clamp(2.5rem, 5vw, 3.5rem);
  }
  .gallery__header h2 { margin-top: 0.5rem; }

  .gallery__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .gallery__item {
    margin: 0;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--color-bg-alt);
  }

  .gallery__img {
    width: 100%;
    height: 240px;
    object-fit: cover;
    display: block;
    transition: transform 0.35s ease;
  }
  .gallery__item:hover .gallery__img { transform: scale(1.03); }

  .gallery__caption {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    text-align: center;
  }

  @media (max-width: 600px) {
    .gallery__grid { grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .gallery__img { height: 180px; }
  }
</style>
```

- [ ] **Step 2: Build — must pass**

```bash
cd dental-template && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/Gallery.astro
git commit -m "feat: add Gallery component — responsive CSS grid with lazy-loaded images"
```

---

## Task 8: Create BeforeAfter.astro

**Files:**
- Create: `dental-template/src/components/BeforeAfter.astro`

- [ ] **Step 1: Create the component**

```astro
---
interface Props {
  data: {
    eyebrow: string;
    title: string;
    items: Array<{ before_url: string; after_url: string; description: string }>;
  };
}
const { data } = Astro.props;
---

<section class="before-after section" id="voor-na">
  <div class="container">
    <div class="before-after__header">
      <span class="eyebrow">{data.eyebrow}</span>
      <h2>{data.title}</h2>
    </div>
    <div class="before-after__list">
      {data.items.map(item => (
        <div class="before-after__pair">
          <div class="before-after__images">
            <div class="before-after__side">
              <span class="before-after__label">Voor</span>
              <img src={item.before_url} alt="Voor de behandeling" loading="lazy" decoding="async" />
            </div>
            <div class="before-after__divider" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </div>
            <div class="before-after__side">
              <span class="before-after__label before-after__label--after">Na</span>
              <img src={item.after_url} alt="Na de behandeling" loading="lazy" decoding="async" />
            </div>
          </div>
          {item.description && (
            <p class="before-after__desc">{item.description}</p>
          )}
        </div>
      ))}
    </div>
  </div>
</section>

<style>
  .before-after__header {
    text-align: center;
    margin-bottom: clamp(2.5rem, 5vw, 3.5rem);
  }
  .before-after__header h2 { margin-top: 0.5rem; }

  .before-after__list {
    display: flex;
    flex-direction: column;
    gap: clamp(3rem, 6vw, 4.5rem);
  }

  .before-after__images {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1.25rem;
  }

  .before-after__side {
    position: relative;
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--color-bg-alt);
  }
  .before-after__side img {
    width: 100%;
    height: 300px;
    object-fit: cover;
    display: block;
  }

  .before-after__label {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    background: rgba(0, 0, 0, 0.65);
    color: white;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.25rem 0.625rem;
    border-radius: var(--radius-sm);
    z-index: 1;
  }
  .before-after__label--after {
    background: var(--color-accent);
  }

  .before-after__divider {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .before-after__desc {
    text-align: center;
    margin-top: 1rem;
    font-size: 0.9375rem;
    color: var(--color-text-muted);
    font-style: italic;
  }

  @media (max-width: 640px) {
    .before-after__images { grid-template-columns: 1fr 1fr; }
    .before-after__divider { display: none; }
    .before-after__side img { height: 180px; }
  }
</style>
```

- [ ] **Step 2: Build — must pass**

```bash
cd dental-template && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/BeforeAfter.astro
git commit -m "feat: add BeforeAfter component — side-by-side before/after image pairs"
```

---

## Task 9: Create Map.astro

**Files:**
- Create: `dental-template/src/components/Map.astro`

`embed_url` may be blank at provisioning time (operator fills per client). Render a placeholder when blank.

- [ ] **Step 1: Create the component**

```astro
---
interface Props {
  data: {
    title: string;
    embed_url: string;
    label: string;
  };
}
const { data } = Astro.props;
---

<section class="map section" id="kaart">
  <div class="container">
    <h2 class="map__title">{data.title}</h2>
    <div class="map__wrapper">
      {data.embed_url ? (
        <iframe
          src={data.embed_url}
          title={data.label}
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen
          class="map__iframe"
        />
      ) : (
        <div class="map__placeholder" aria-label="Kaart nog niet geconfigureerd">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <p>Kaart wordt hier weergegeven na configuratie.</p>
          <p class="map__placeholder-sub">Vul de embed URL in via het CMS of neem contact op met uw beheerder.</p>
        </div>
      )}
      {data.label && (
        <p class="map__label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          {data.label}
        </p>
      )}
    </div>
  </div>
</section>

<style>
  .map__title {
    text-align: center;
    margin-bottom: clamp(2rem, 4vw, 3rem);
  }

  .map__wrapper {
    border-radius: var(--radius-xl);
    overflow: hidden;
    border: 1.5px solid var(--color-border);
  }

  .map__iframe {
    width: 100%;
    height: 420px;
    border: none;
    display: block;
  }

  .map__placeholder {
    height: 300px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background: var(--color-bg-alt);
    color: var(--color-text-muted);
    text-align: center;
    padding: 2rem;
  }
  .map__placeholder p { margin: 0; font-size: 0.9375rem; }
  .map__placeholder-sub { font-size: 0.8125rem; opacity: 0.7; }

  .map__label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.875rem 1.25rem;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    background: var(--color-bg-alt);
    margin: 0;
    border-top: 1.5px solid var(--color-border);
  }

  @media (max-width: 600px) {
    .map__iframe { height: 280px; }
  }
</style>
```

- [ ] **Step 2: Build — must pass**

```bash
cd dental-template && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/Map.astro
git commit -m "feat: add Map component — iframe embed with graceful placeholder when URL is blank"
```

---

## Task 10: Create Pricing.astro

**Files:**
- Create: `dental-template/src/components/Pricing.astro`

- [ ] **Step 1: Create the component**

```astro
---
interface Props {
  data: {
    eyebrow: string;
    title: string;
    disclaimer: string;
    items: Array<{ treatment: string; price: string; notes: string }>;
  };
}
const { data } = Astro.props;
---

<section class="pricing section" id="tarieven">
  <div class="container container--narrow">
    <div class="pricing__header">
      <span class="eyebrow">{data.eyebrow}</span>
      <h2>{data.title}</h2>
    </div>
    <div class="pricing__card">
      <table class="pricing__table">
        <thead>
          <tr>
            <th>Behandeling</th>
            <th>Tarief</th>
            <th class="pricing__th--notes">Opmerkingen</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => (
            <tr class={i % 2 === 0 ? 'pricing__row--alt' : ''}>
              <td class="pricing__treatment">{item.treatment}</td>
              <td class="pricing__price">{item.price}</td>
              <td class="pricing__notes">{item.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {data.disclaimer && (
      <p class="pricing__disclaimer">{data.disclaimer}</p>
    )}
  </div>
</section>

<style>
  .pricing__header {
    text-align: center;
    margin-bottom: clamp(2.5rem, 5vw, 3.5rem);
  }
  .pricing__header h2 { margin-top: 0.5rem; }

  .pricing__card {
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  .pricing__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9375rem;
  }

  .pricing__table thead {
    background: var(--color-bg-alt);
  }
  .pricing__table th {
    padding: 0.875rem 1.5rem;
    text-align: left;
    font-family: var(--font-body);
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    border-bottom: 1.5px solid var(--color-border);
  }
  .pricing__th--notes { color: transparent; } /* hidden label, keeps column */

  .pricing__table td {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border);
    vertical-align: top;
  }
  .pricing__table tr:last-child td { border-bottom: none; }

  .pricing__row--alt { background: var(--color-bg-alt); }

  .pricing__treatment {
    font-weight: 500;
    color: var(--color-text);
  }
  .pricing__price {
    color: var(--color-accent);
    font-weight: 600;
    white-space: nowrap;
  }
  .pricing__notes {
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .pricing__disclaimer {
    margin-top: 1.25rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    text-align: center;
    font-style: italic;
  }

  @media (max-width: 600px) {
    .pricing__table th,
    .pricing__table td { padding: 0.75rem 1rem; }
    .pricing__th--notes,
    .pricing__notes { display: none; }
  }
</style>
```

- [ ] **Step 2: Build — must pass**

```bash
cd dental-template && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add dental-template/src/components/Pricing.astro
git commit -m "feat: add Pricing component — striped treatment price table with disclaimer"
```

---

## Task 11: Refactor index.astro — dynamic section renderer

**Files:**
- Modify: `dental-template/src/pages/index.astro`

This is the integration task. All components from Tasks 5–10 are imported and wired into the SECTION_MAP. The Contact prop signature is **not** extended here (that belongs to the contact-form plan).

- [ ] **Step 1: Replace index.astro entirely**

```astro
---
import site from '../data/site.json';
import sectionsData from '../data/sections.json';
import faq from '../data/faq.json';
import gallery from '../data/gallery.json';
import beforeAfter from '../data/before_after.json';
import mapData from '../data/map.json';
import emergency from '../data/emergency.json';
import pricing from '../data/pricing.json';

import Layout from '../layouts/Layout.astro';
import Nav from '../components/Nav.astro';
import Hero from '../components/Hero.astro';
import Quote from '../components/Quote.astro';
import Features from '../components/Features.astro';
import Services from '../components/Services.astro';
import About from '../components/About.astro';
import Reviews from '../components/Reviews.astro';
import OpeningHours from '../components/OpeningHours.astro';
import Vergoeding from '../components/Vergoeding.astro';
import Contact from '../components/Contact.astro';
import Footer from '../components/Footer.astro';
import EmergencyBanner from '../components/EmergencyBanner.astro';
import FAQ from '../components/FAQ.astro';
import Gallery from '../components/Gallery.astro';
import BeforeAfter from '../components/BeforeAfter.astro';
import Map from '../components/Map.astro';
import Pricing from '../components/Pricing.astro';

const homeSections = sectionsData.pages.home;
---

<Layout title={site.meta.title} description={site.meta.description}>
  <Nav business={site.business} nav={site.nav} />
  {emergency.enabled && <EmergencyBanner data={emergency} />}
  <main>
    {homeSections
      .filter(s => s.enabled)
      .map(s => {
        if (s.id === 'hero')         return <Hero data={site.hero} business={site.business} />;
        if (s.id === 'quote')        return <Quote data={site.quote} />;
        if (s.id === 'features')     return <Features data={site.features} />;
        if (s.id === 'services')     return <Services data={site.services} />;
        if (s.id === 'team')         return <About data={site.team} />;
        if (s.id === 'reviews')      return <Reviews data={site.reviews} />;
        if (s.id === 'hours')        return <OpeningHours data={site.hours} business={site.business} />;
        if (s.id === 'vergoeding')   return <Vergoeding data={site.vergoeding} />;
        if (s.id === 'contact')      return <Contact data={site.contact} business={site.business} />;
        if (s.id === 'faq')          return <FAQ data={faq} />;
        if (s.id === 'gallery')      return <Gallery data={gallery} />;
        if (s.id === 'before_after') return <BeforeAfter data={beforeAfter} />;
        if (s.id === 'map')          return <Map data={mapData} />;
        if (s.id === 'pricing')      return <Pricing data={pricing} />;
        return null;
      })
    }
  </main>
  <Footer business={site.business} footer={site.footer} />
</Layout>
```

> **Spec deviation:** The spec shows `SECTION_MAP` as an object of arrow functions (`{ hero: () => <Hero ... />, ... }`). This plan uses an explicit `if` chain instead. Reason: Astro's static build does not support calling JSX-returning functions stored in plain objects without triggering hydration/type issues. The `if` chain is semantically identical and produces the same output. Update the spec after this ships if the team prefers SECTION_MAP documented as the canonical pattern.

> **Note:** `Nav` no longer has the temporary default added in Task 3. The `nav` prop is now explicitly passed from `site.nav`. Remove the default from `Nav.astro` if you added it:
> Change: `const { business, nav = { links: [...] } } = Astro.props;`
> Back to: `const { business, nav } = Astro.props;`

- [ ] **Step 2: Remove the temporary Nav.astro default (if added in Task 3)**

In `dental-template/src/components/Nav.astro`, line 8:

Change:
```astro
const { business, nav = { links: [
  { label: 'Diensten', href: '#diensten' },
  { label: 'Team', href: '#over-ons' },
  { label: 'Vergoeding', href: '#vergoeding' },
  { label: 'Contact', href: '#contact' }
] } } = Astro.props;
```

Back to:
```astro
const { business, nav } = Astro.props;
```

- [ ] **Step 3: Build — must pass cleanly**

```bash
cd dental-template
npm run build 2>&1
```

Expected: build succeeds with no TypeScript errors. Check that all 14 section IDs in `sections.json` resolve without warnings.

- [ ] **Step 4: Smoke test in dev server**

```bash
cd dental-template
npm run dev
```

Open `http://localhost:4321`. Verify:
- Nav renders 4 links from `site.json.nav.links` (not hardcoded)
- Footer renders tagline, no social icons (empty array)
- Emergency banner is NOT visible (`enabled: false` in emergency.json)
- All existing sections render in order (hero → quote → features → services → team → reviews → hours → vergoeding → contact)
- No new optional sections visible (all `enabled: false` in sections.json)

- [ ] **Step 5: Test an optional section by enabling it**

Temporarily set `faq` to `enabled: true` in `dental-template/src/data/sections.json`. The FAQ section should appear after Contact with the Dutch placeholder Q&A. Then revert to `false`.

- [ ] **Step 6: Test emergency banner**

Temporarily set `enabled: true` in `dental-template/src/data/emergency.json`. The red banner should appear above `<main>`. Then revert.

- [ ] **Step 7: Commit**

```bash
cd dental-template
git add src/pages/index.astro src/components/Nav.astro
git commit -m "feat: refactor index.astro to data-driven section renderer with SECTION_MAP"
```

---

## Task 12: Create admin/config.yml — Sveltia CMS configuration

**Files:**
- Create: `dental-template/public/admin/config.yml`

The complete YAML is specified verbatim in the spec. This task writes it exactly as specified, then validates the YAML structure.

**Critical implementation note from spec:** All `site.json` fields are in **one** single file collection entry. Multiple entries pointing at the same file risk data loss (last write wins).

- [ ] **Step 1: Write config.yml**

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
              - { name: eyebrow,       label: Eyebrow,        widget: string }
              - { name: headline,      label: Koptekst,       widget: string }
              - { name: description,   label: Omschrijving,   widget: text   }
              - { name: cta_primary,   label: Knop primair,   widget: string }
              - { name: cta_secondary, label: Knop secundair, widget: string }
              - { name: image_url,     label: Afbeelding URL, widget: string }

          - name: quote
            label: Quote
            widget: object
            fields:
              - { name: text,        label: Tekst,   widget: text   }
              - { name: author_name, label: Naam,    widget: string }
              - { name: author_role, label: Functie, widget: string }

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
                  - { name: day,  label: Dag,  widget: string  }
                  - { name: time, label: Tijd, widget: string  }
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
          - { name: text,    label: Tekst,     widget: string  }
          - { name: phone,   label: Telefoon,  widget: string  }
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

- [ ] **Step 2: Validate YAML syntax**

```bash
cd dental-template
python3 -c "
import sys
try:
    import yaml
    yaml.safe_load(open('public/admin/config.yml'))
    print('YAML valid')
except ImportError:
    # pyyaml not installed — fall back to structure check
    import re
    text = open('public/admin/config.yml').read()
    assert 'collections:' in text
    assert 'backend:' in text
    print('YAML structure OK (install pyyaml for full parse validation)')
except Exception as e:
    print('YAML error:', e); sys.exit(1)
"
```

Expected: `YAML valid` (or `YAML structure OK` if pyyaml not installed). To install: `pip3 install pyyaml`.

- [ ] **Step 3: HUMAN VALIDATION REQUIRED — Sveltia sections panel**

> **Decision point (reserve for human):** The `sections` collection uses a list widget with an `id` field of type `string`. If clients can freely edit the `id` value, they can corrupt `sections.json` and break their site.
>
> **Validate on live Sveltia + Gitea instance:**
> 1. Load a client's CMS
> 2. Open Secties → Sectievolgorde & zichtbaarheid
> 3. Check whether the `id` field in each list item is editable or display-only
>
> **If `id` IS editable** (bad): Replace the reorderable list with a fixed set of boolean fields — one per section:
> ```yaml
> fields:
>   - { name: hero_enabled,         label: Hero actief,         widget: boolean, default: true }
>   - { name: faq_enabled,          label: FAQ actief,          widget: boolean, default: false }
>   # ... etc
> ```
> Then update `sections.json` schema and `index.astro` filter logic to match.
>
> **If `id` is NOT editable** (good): Ship as-is.
>
> Do not resolve this autonomously.

- [ ] **Step 4: Commit**

```bash
git add dental-template/public/admin/config.yml
git commit -m "feat: add complete Sveltia CMS config.yml — all client-editable fields"
```

---

## Task 13: Update build-sites.js provisioning

**Files:**
- Modify: `build-sites.js`

Three changes:
1. Write all six new placeholder JSON files to `builds/{id}/src/data/` alongside site.json and theme.json
2. Handle the new `form_recipient_email` CSV column (default to `email` if blank)
3. Inject `nav`, `footer.social`, and `contact_form` into site.json (both dummy and Groq-generated)

- [ ] **Step 1: Add the new data file list near the top of build-sites.js**

Locate the section in `main()` where data files are written (around line 507):
```js
fs.writeFileSync(path.join(buildDir, 'src/data/site.json'),  JSON.stringify(siteJson,  null, 2));
fs.writeFileSync(path.join(buildDir, 'src/data/theme.json'), JSON.stringify(themeJson, null, 2));
```

Add after those two lines:
```js
// Write new optional-section placeholder files (read from template)
const NEW_DATA_FILES = [
  'sections.json',
  'faq.json',
  'gallery.json',
  'before_after.json',
  'map.json',
  'emergency.json',
  'pricing.json',
];
for (const filename of NEW_DATA_FILES) {
  const src  = path.join(TEMPLATE_DIR, 'src/data', filename);
  const dest = path.join(buildDir, 'src/data', filename);
  fs.copyFileSync(src, dest);
}
```

Where `TEMPLATE_DIR` is the path to `dental-template/`. Check the existing constant name at the top of `build-sites.js` (it may be called `TEMPLATE_DIR` or similar — use whatever exists).

- [ ] **Step 2: Add a helper to build the CMS-related defaults**

Add this function near the other builders (e.g., after `buildTheme`):

```js
function buildCmsDefaults(prospect) {
  const recipientEmail = (prospect.form_recipient_email || prospect.email || '').trim();
  return {
    nav: {
      links: [
        { label: 'Diensten',   href: '#diensten'   },
        { label: 'Team',       href: '#over-ons'   },
        { label: 'Vergoeding', href: '#vergoeding' },
        { label: 'Contact',    href: '#contact'    },
      ],
    },
    footer_social: [],
    contact_form: {
      recipient_email: recipientEmail,
      confirmation_message: 'Bedankt! Wij nemen binnen één werkdag contact op.',
    },
  };
}
```

- [ ] **Step 3: Update buildDummySiteJson to set recipient_email from prospect**

`buildDummySiteJson` reads `dental-template/src/data/site.json` as a template and mutates it. After Task 2, `site.json` already has `nav`, `footer.social`, and `contact_form` — so the function inherits them automatically. The only prospect-specific value is `contact_form.recipient_email`.

Add **one line** after the existing mutations in `buildDummySiteJson` (before `return template`):

```js
function buildDummySiteJson(prospect) {
  const template = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, 'src/data/site.json'), 'utf-8'));
  template.meta.title       = `${prospect.business_name} – ${prospect.city}`;
  template.meta.description = `Tandartspraktijk in ${prospect.city}. Professionele zorg voor uw gebit.`;
  template.business.name        = prospect.business_name;
  template.business.city        = prospect.city;
  template.business.address     = prospect.address;
  template.business.postal_code = prospect.postal_code;
  template.business.phone       = prospect.phone;
  template.business.email       = prospect.email;
  template.hero.eyebrow   = `Tandarts ${prospect.city}`;
  template.hero.image_url = 'https://picsum.photos/seed/dental-hero/720/860';
  // Set contact form recipient from CSV (new field — defaults to business email)
  template.contact_form.recipient_email = (prospect.form_recipient_email || prospect.email || '').trim();
  return template;
}
```

> **Note:** `buildCmsDefaults` from Step 2 is still used for the Groq-generated path in Step 4. For the dummy path, the template already carries the `nav` and `footer.social` defaults from `site.json`.

- [ ] **Step 4: Merge CMS defaults into Groq-generated site.json**

In the `main()` loop, after `generateSiteJson` returns `siteJson`, merge the defaults:

```js
siteJson = await generateSiteJson(client, prospect);
// Merge CMS fields that Groq does not generate
const cms = buildCmsDefaults(prospect);
siteJson.nav          = cms.nav;
siteJson.contact_form = cms.contact_form;
siteJson.footer       = { ...(siteJson.footer ?? {}), social: cms.footer_social };
```

- [ ] **Step 5: Smoke test with --dummy flag**

```bash
node build-sites.js --dummy
```

Expected: build runs, all data files (including sections.json, faq.json, etc.) are written to `builds/{id}/src/data/`, build completes successfully. Check one build directory:

```bash
ls builds/1/src/data/
```

Expected output includes: `site.json  theme.json  sections.json  faq.json  gallery.json  before_after.json  map.json  emergency.json  pricing.json`

Also verify the generated site.json has the new fields:
```bash
python3 -c "
import json
s = json.load(open('builds/1/src/data/site.json'))
print('nav:', 'nav' in s, '| contact_form:', 'contact_form' in s, '| footer.social:', isinstance(s['footer'].get('social'), list))
"
```

Expected: `nav: true | contact_form: true | footer.social: true`

- [ ] **Step 6: Commit**

```bash
git add build-sites.js
git commit -m "feat: build-sites.js writes new section data files and injects nav/contact_form/footer.social"
```

---

## Task 14: Final integration build and visual verification

- [ ] **Step 1: Full clean build**

```bash
cd dental-template
rm -rf dist .astro
npm run build
```

Expected: no errors, `dist/` created.

- [ ] **Step 2: Run dev server for visual QA**

```bash
cd dental-template
npm run dev
```

Check in browser at `http://localhost:4321`:

| Check | Expected |
|---|---|
| Nav links | 4 links from site.json.nav.links, not hardcoded |
| Footer | Tagline shown, no social icons (empty array) |
| Emergency banner | Not visible (`enabled: false`) |
| Section order | hero → quote → features → services → team → reviews → hours → vergoeding → contact |
| Optional sections | None visible (all `enabled: false`) |
| No console errors | Zero JS errors |

- [ ] **Step 3: Test enabling all optional sections at once**

In `sections.json`, set all six optional sections to `enabled: true`. Reload dev server. Verify all six sections render with Dutch placeholder content after Contact, in the order defined in sections.json.

- [ ] **Step 4: Revert sections.json**

Set all six optional sections back to `enabled: false`.

- [ ] **Step 5: Test emergency banner**

Set `emergency.json.enabled` to `true`. Verify the red banner appears above `<main>`. Revert.

- [ ] **Step 6: Final commit**

```bash
cd dental-template
git add -A
git commit -m "chore: verify all sections render correctly — integration complete"
```

---

## Open decisions (reserved for human)

| # | Question | Impact | Where it lands |
|---|---|---|---|
| 1 | Sveltia `id` field in list items — read-only or editable? | If editable, must replace sections panel with fixed booleans | Task 12 step 3 |
| 2 | Google Maps embed URL — document as manual step or default to OpenStreetMap? | Affects operator onboarding docs | map.json `embed_url` |
| 3 | Groq prompt — update to generate Dutch nav labels, or always use hardcoded defaults? | If updated, nav labels can be practice-specific | Task 13 step 4 |

---

## What this plan does NOT cover

- **Contact form worker integration** — updating `Contact.astro` to submit to the CF Worker, adding `worker_url` injection, Turnstile. Separate plan needed.
- **`[slug].astro` new pages** — client-created Markdown pages at flat slugs. Separate plan needed.
- **Gitea repo creation and file push** — the full `build-sites.js` provisioning of Gitea users, repos, secrets, deploy.yml. Separate plan needed.
- **`admin/config.yml` template** — `config.yml` lives in `public/admin/` of the dental-template (operator-controlled). For per-client Gitea repos, it is copied by the deploy workflow as specified in the spec's deploy.yml inject step. No additional file needed here.
- **`deploy.yml` inject step** — the spec defines a Gitea Actions workflow that copies client files into the template and injects `FORMS_WORKER_URL` via `jq`. This workflow lives in each client's Gitea repo, not in `autosite/`. Writing and pushing it is part of the Gitea provisioning plan.
