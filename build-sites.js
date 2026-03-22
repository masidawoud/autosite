#!/usr/bin/env node
/**
 * AutoSite Pipeline
 * Reads prospects.csv → generates site.json via Groq API → builds Astro site → deploys to Cloudflare Pages
 */

import fs   from 'fs';
import path from 'path';
import { execSync }      from 'child_process';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ───────────────────────────────────────────────────────────────────

const TEMPLATE_DIR  = path.join(__dirname, 'dental-template');
const BUILDS_DIR    = path.join(__dirname, 'builds');
const PROSPECTS_CSV = path.join(__dirname, 'prospects.csv');
const THEMES_DIR    = path.join(TEMPLATE_DIR, 'src/data/themes');
const MODEL         = 'llama-3.3-70b-versatile';

// ── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]));
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += line[i];
    }
  }
  result.push(current);
  return result;
}

function serializeCSV(records) {
  const headers = Object.keys(records[0]);
  const lines = [headers.join(',')];
  for (const record of records) {
    const values = headers.map(h => {
      const val = String(record[h] ?? '');
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n') + '\n';
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

/** Darken a hex color by reducing RGB channels */
function darken(hex, amount = 20) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r - amount, g: g - amount, b: b - amount });
}

/** Lighten a hex color by mixing toward white (factor 0–1, higher = lighter) */
function lighten(hex, factor = 0.85) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: r + (255 - r) * factor,
    g: g + (255 - g) * factor,
    b: b + (255 - b) * factor,
  });
}

// ── Theme builder ─────────────────────────────────────────────────────────────

function buildTheme(prospect) {
  const presetName = prospect.style_preset || 'warm-editorial';
  const presetPath = path.join(THEMES_DIR, `${presetName}.json`);

  let theme;
  if (fs.existsSync(presetPath)) {
    theme = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
  } else {
    console.warn(`    ⚠ Preset "${presetName}" not found, falling back to warm-editorial`);
    theme = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, 'warm-editorial.json'), 'utf-8'));
  }

  // Inject brand colors from CSV
  if (prospect.brand_color_1?.startsWith('#')) {
    theme.colors.accent = prospect.brand_color_1;
    theme.colors.accent_hover = prospect.brand_color_2?.startsWith('#')
      ? prospect.brand_color_2
      : darken(prospect.brand_color_1, 20);
    theme.colors.accent_light = lighten(prospect.brand_color_1, 0.85);
  }

  return theme;
}

// ── Template cloner ───────────────────────────────────────────────────────────

function cloneTemplate(targetDir) {
  // Clean previous build
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  // Copy template source files (exclude node_modules and build artifacts)
  execSync(
    `rsync -a --exclude='node_modules/' --exclude='dist/' --exclude='.astro/' "${TEMPLATE_DIR}/" "${targetDir}/"`,
    { stdio: 'pipe' }
  );

  // Symlink node_modules from the template (fast, reliable, saves disk space)
  const srcModules = path.join(TEMPLATE_DIR, 'node_modules');
  const dstModules = path.join(targetDir, 'node_modules');
  if (fs.existsSync(srcModules)) {
    fs.symlinkSync(srcModules, dstModules);
  } else {
    execSync('npm install', { cwd: targetDir, stdio: 'pipe' });
  }
}

// ── CMS defaults ──────────────────────────────────────────────────────────────

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

// ── Dummy data (no API) ───────────────────────────────────────────────────────

function buildDummyConfig(prospect) {
  const business     = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, 'src/data/business.json'),     'utf-8'));
  const nav          = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, 'src/data/nav.json'),          'utf-8'));
  const contactForm  = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, 'src/data/contact_form.json'), 'utf-8'));
  const footer       = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, 'src/data/footer.json'),       'utf-8'));
  const emergency    = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, 'src/data/emergency.json'),    'utf-8'));

  business.name        = prospect.business_name;
  business.city        = prospect.city;
  business.address     = prospect.address;
  business.postal_code = prospect.postal_code;
  business.phone       = prospect.phone;
  business.email       = prospect.email;
  footer.meta_title       = `${prospect.business_name} – ${prospect.city}`;
  footer.meta_description = `Tandartspraktijk in ${prospect.city}. Professionele zorg voor uw gebit.`;
  contactForm.recipient_email = (prospect.form_recipient_email || prospect.email || '').trim();

  return { business, nav, contactForm, footer, emergency };
}

function buildDummyHomePage(prospect) {
  const homeMd = fs.readFileSync(path.join(TEMPLATE_DIR, 'src/content/pages/home.md'), 'utf-8');
  // Extract JSON frontmatter (between --- delimiters)
  const match = homeMd.match(/^---\n([\s\S]*?)\n---/);
  const template = match ? JSON.parse(match[1]) : { title: 'Home', sections: [] };
  const hero = (template.sections || []).find(s => s.type === 'hero');
  if (hero) {
    hero.eyebrow   = `Tandarts ${prospect.city}`;
    hero.image_url = 'https://picsum.photos/seed/dental-hero/720/860';
  }
  return template;
}

// ── Groq API ──────────────────────────────────────────────────────────────────

async function generateSiteJson(client, prospect) {
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'system',
        content: [
          'Je bent een expert copywriter gespecialiseerd in tandartspraktijken in Nederland.',
          'Je schrijft professionele, warme en patiëntgerichte teksten in het Nederlands.',
          'Je antwoord bevat ALLEEN geldige JSON — geen uitleg, geen markdown, puur JSON.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildPrompt(prospect),
      },
    ],
  });

  const raw = response.choices[0].message.content.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Claude returned invalid JSON: ${e.message}\n\nFirst 400 chars:\n${raw.slice(0, 400)}`);
  }
}

function buildPrompt(p) {
  return `Genereer een volledig site.json bestand voor een Nederlandse tandartspraktijk.

## Praktijkgegevens
- Naam: ${p.business_name}
- Stad: ${p.city}
- Adres: ${p.address}, ${p.postal_code} ${p.city}
- Telefoon: ${p.phone}
- E-mail: ${p.email}
- Diensten: ${p.services}
- Beschikbare informatie: ${p.scraped_text || 'Geen extra informatie beschikbaar.'}

## Schrijfinstructies
- Alle teksten in professioneel, warm Nederlands
- Headline (hero): pakkend, uniek voor deze praktijk, max 10 woorden
- Zorg dat elke tekst specifiek aanvoelt voor deze praktijk, niet generiek
- Genereer 3 plausibele Nederlandse teamleden met realistische namen en rollen
- Genereer 6 Google-stijl reviews met diverse Nederlandse namen en data (laatste 6 maanden)
- Review teksten: authentiek, gevarieerd, specifiek (niet allemaal hetzelfde)
- Openingstijden: standaard Nederlandse tandartstijden
- De vergoeding-teksten mogen standaard zijn (dit verandert niet per praktijk)

## Vereiste JSON-structuur (vervang alle "..." met echte inhoud)

{
  "meta": {
    "title": "...",
    "description": "..."
  },
  "business": {
    "name": "${p.business_name}",
    "city": "${p.city}",
    "address": "${p.address}",
    "postal_code": "${p.postal_code}",
    "phone": "${p.phone}",
    "email": "${p.email}",
    "google_reviews_score": "4.8",
    "google_reviews_count": 94,
    "google_reviews_url": "#"
  },
  "hero": {
    "eyebrow": "Tandarts ${p.city}",
    "headline": "...",
    "description": "...",
    "cta_primary": "Afspraak Maken",
    "cta_secondary": "Bel ons",
    "image_url": "https://picsum.photos/seed/dental-hero/720/860"
  },
  "quote": {
    "text": "...",
    "author_name": "Dr. [Nederlandse naam]",
    "author_role": "Tandarts & Oprichter"
  },
  "features": {
    "eyebrow": "Waarom kiezen voor ons",
    "title": "...",
    "subtitle": "...",
    "image_url": "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=640&h=780&fit=crop&crop=center",
    "items": [
      { "icon": "shield", "title": "...", "desc": "..." },
      { "icon": "clock",  "title": "...", "desc": "..." },
      { "icon": "team",   "title": "...", "desc": "..." },
      { "icon": "tech",   "title": "...", "desc": "..." },
      { "icon": "heart",  "title": "...", "desc": "..." },
      { "icon": "card",   "title": "...", "desc": "..." }
    ]
  },
  "services": {
    "eyebrow": "Onze Diensten",
    "title": "...",
    "subtitle": "...",
    "items": [
      {
        "tag": "Preventieve Zorg",
        "title": "...",
        "desc": "...",
        "image_url": "https://images.unsplash.com/photo-1588776814546-1ffedba9e9a0?w=640&h=440&fit=crop&crop=center",
        "items": ["...", "...", "..."],
        "cta": "Afspraak Inplannen"
      },
      {
        "tag": "Esthetische Zorg",
        "title": "...",
        "desc": "...",
        "image_url": "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=640&h=440&fit=crop&crop=center",
        "items": ["...", "...", "..."],
        "cta": "Meer Informatie"
      },
      {
        "tag": "Specialistische Zorg",
        "title": "...",
        "desc": "...",
        "image_url": "https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=640&h=440&fit=crop&crop=center",
        "items": ["...", "...", "..."],
        "cta": "Plan een Consult"
      }
    ]
  },
  "team": {
    "eyebrow": "Ons Team",
    "title": "...",
    "subtitle": "...",
    "members": [
      {
        "name": "Dr. [Nederlandse naam]",
        "role": "Tandarts & Oprichter",
        "bio": "...",
        "image_url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=440&h=520&fit=crop&crop=faces,top"
      },
      {
        "name": "Dr. [Nederlandse naam]",
        "role": "Tandarts",
        "bio": "...",
        "image_url": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=440&h=520&fit=crop&crop=faces,top"
      },
      {
        "name": "[Nederlandse naam]",
        "role": "Mondhygiënist",
        "bio": "...",
        "image_url": "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=440&h=520&fit=crop&crop=faces,top"
      }
    ]
  },
  "reviews": {
    "title": "...",
    "subtitle": "...",
    "items": [
      { "name": "...", "stars": 5, "date": "januari 2025",   "text": "..." },
      { "name": "...", "stars": 5, "date": "december 2024",  "text": "..." },
      { "name": "...", "stars": 5, "date": "november 2024",  "text": "..." },
      { "name": "...", "stars": 5, "date": "oktober 2024",   "text": "..." },
      { "name": "...", "stars": 5, "date": "september 2024", "text": "..." },
      { "name": "...", "stars": 5, "date": "augustus 2024",  "text": "..." }
    ]
  },
  "hours": {
    "items": [
      { "day": "Maandag",   "time": "08:00 – 17:30", "open": true },
      { "day": "Dinsdag",   "time": "08:00 – 17:30", "open": true },
      { "day": "Woensdag",  "time": "08:00 – 17:30", "open": true },
      { "day": "Donderdag", "time": "08:00 – 19:00", "open": true },
      { "day": "Vrijdag",   "time": "08:00 – 16:00", "open": true },
      { "day": "Zaterdag",  "time": "Op afspraak",   "open": true },
      { "day": "Zondag",    "time": "Gesloten",      "open": false }
    ]
  },
  "vergoeding": {
    "eyebrow": "Financiën & Vergoeding",
    "title": "...",
    "intro": "...",
    "blocks": [
      { "title": "Basiszorgverzekering",  "text": "..." },
      { "title": "Aanvullende Verzekering", "text": "..." },
      { "title": "Particulier Tarief",    "text": "..." }
    ],
    "insurers": ["Zilveren Kruis", "CZ", "Menzis", "VGZ", "DSW", "ONVZ", "ASR", "Nationale Nederlanden", "Zorg en Zekerheid", "Eno"],
    "cta": "Vraag naar uw vergoeding"
  },
  "contact": {
    "eyebrow": "Neem Contact Op",
    "title": "...",
    "intro": "..."
  },
  "footer": {
    "tagline": "..."
  }
}

Geef ALLEEN de JSON terug. Geen uitleg, geen markdown, puur JSON.`;
}

// ── Deploy ────────────────────────────────────────────────────────────────────

function deploy(buildDir, prospect) {
  const projectName = `tandarts-${slugify(prospect.business_name)}`.slice(0, 58);
  console.log(`    ⟳ Deploying as "${projectName}"...`);

  const env = {
    ...process.env,
    CLOUDFLARE_API_TOKEN:  process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  };

  // Create project if it doesn't exist yet (Wrangler 4+ requires this)
  try {
    execSync(
      `npx wrangler pages project create "${projectName}" --production-branch=main`,
      { cwd: buildDir, encoding: 'utf-8', env, stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch {
    // Project already exists — that's fine, continue to deploy
  }

  let output = '';
  try {
    output = execSync(
      `npx wrangler pages deploy dist/ --project-name="${projectName}" --branch=main --commit-dirty`,
      { cwd: buildDir, encoding: 'utf-8', env, stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (err) {
    const detail = (err.stdout || '') + (err.stderr || '');
    throw new Error(`Wrangler deploy failed:\n${detail.trim()}`);
  }

  return `https://${projectName}.pages.dev`;
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

// ── CSV persistence ───────────────────────────────────────────────────────────

function setField(records, id, field, value) {
  const record = records.find(r => r.id === id);
  if (record) record[field] = value;
}

function saveCSV(records) {
  fs.writeFileSync(PROSPECTS_CSV, serializeCSV(records));
}

// ── .env loader ───────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const deployOnly = process.argv.includes('--deploy-only');
  const dummy      = process.argv.includes('--dummy');

  if (!deployOnly && !dummy && !process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set. Copy .env.example to .env and fill in your keys.');
  }

  const client = (deployOnly || dummy) ? null : new Groq({ apiKey: process.env.GROQ_API_KEY });

  if (!fs.existsSync(BUILDS_DIR)) fs.mkdirSync(BUILDS_DIR, { recursive: true });

  const records = parseCSV(fs.readFileSync(PROSPECTS_CSV, 'utf-8'));
  const pending = records.filter(r => r.status === 'pending');

  console.log('\n🦷  AutoSite Pipeline' + (deployOnly ? ' (deploy-only)' : dummy ? ' (dummy)' : ''));
  console.log(`    ${pending.length} pending prospect(s)\n`);

  if (pending.length === 0) {
    console.log('    Nothing to do — set status to "pending" in prospects.csv to (re)process.');
    return;
  }

  for (const prospect of pending) {
    console.log(`\n── ${prospect.business_name} (${prospect.city}) [${prospect.style_preset}] ──`);

    try {
      const buildDir = path.join(BUILDS_DIR, prospect.id);

      if (deployOnly) {
        // Skip content generation and Astro build — use existing dist/
        const distDir = path.join(buildDir, 'dist');
        if (!fs.existsSync(distDir)) {
          throw new Error(`No existing build found at ${distDir} — run without --deploy-only first`);
        }
        console.log(`    ✓ Using existing build at builds/${prospect.id}/dist`);
      } else {
        // 1. Generate site content
        let configFiles, homeJson;
        if (dummy) {
          configFiles = buildDummyConfig(prospect);
          homeJson    = buildDummyHomePage(prospect);
          console.log('    ✓ Dummy content ready');
        } else {
          console.log('    ⟳ Generating content...');
          const siteJson = await generateSiteJson(client, prospect);
          const recipientEmail = (prospect.form_recipient_email || prospect.email || '').trim();
          configFiles = {
            business: siteJson.business,
            nav:      siteJson.nav ?? { links: [] },
            contactForm: {
              recipient_email:      recipientEmail,
              confirmation_message: 'Bedankt! Wij nemen binnen één werkdag contact op.',
            },
            footer: {
              meta_title:       siteJson.meta?.title       ?? `${prospect.business_name} – ${prospect.city}`,
              meta_description: siteJson.meta?.description ?? '',
              tagline:          siteJson.footer?.tagline   ?? '',
              social:           [],
            },
            emergency: {
              text:    'Spoedeisende tandheelkundige hulp nodig? Wij staan voor u klaar.',
              phone:   siteJson.business?.phone ?? '',
              enabled: false,
            },
          };
          const coreTypes = ['hero','quote','features','services','team','reviews','hours','vergoeding','contact'];
          // templateHome only used below for fallback map lookup (kept for reference, not written to disk)
          const _homeMd = fs.readFileSync(path.join(TEMPLATE_DIR, 'src/content/pages/home.md'), 'utf-8');
          const _match = _homeMd.match(/^---\n([\s\S]*?)\n---/);
          const templateHome = _match ? JSON.parse(_match[1]) : { sections: [] };
          homeJson = {
            sections: [
              { type: 'hero',       enabled: true, ...siteJson.hero       },
              { type: 'quote',      enabled: true, ...siteJson.quote      },
              { type: 'features',   enabled: true, ...siteJson.features   },
              { type: 'services',   enabled: true, ...siteJson.services   },
              { type: 'team',       enabled: true, ...siteJson.team       },
              { type: 'reviews',    enabled: true, ...siteJson.reviews    },
              { type: 'hours',      enabled: true, ...siteJson.hours      },
              { type: 'vergoeding', enabled: true, ...siteJson.vergoeding },
              { type: 'contact',    enabled: true, ...siteJson.contact    },
              ...templateHome.sections.filter(s => !coreTypes.includes(s.type)),
            ],
          };
          console.log('    ✓ Content generated');
        }

        // 2. Build theme (preset + brand colors)
        const themeJson = buildTheme(prospect);
        console.log(`    ✓ Theme ready (${themeJson.preset}, accent: ${themeJson.colors.accent})`);

        // 3. Clone template
        console.log('    ⟳ Cloning template...');
        cloneTemplate(buildDir);
        console.log('    ✓ Template ready');

        // 4. Write data files
        fs.mkdirSync(path.join(buildDir, 'src/content/pages'), { recursive: true });
        fs.writeFileSync(path.join(buildDir, 'src/data/business.json'),     JSON.stringify(configFiles.business,    null, 2));
        fs.writeFileSync(path.join(buildDir, 'src/data/nav.json'),          JSON.stringify(configFiles.nav,         null, 2));
        fs.writeFileSync(path.join(buildDir, 'src/data/contact_form.json'), JSON.stringify(configFiles.contactForm, null, 2));
        fs.writeFileSync(path.join(buildDir, 'src/data/footer.json'),       JSON.stringify(configFiles.footer,      null, 2));
        fs.writeFileSync(path.join(buildDir, 'src/data/emergency.json'),    JSON.stringify(configFiles.emergency,   null, 2));
        fs.writeFileSync(path.join(buildDir, 'src/data/theme.json'),        JSON.stringify(themeJson,               null, 2));
        // Write home page as markdown with JSON frontmatter
        const homeFrontmatter = JSON.stringify({ title: homeJson.title || 'Home', published: true, sections: homeJson.sections }, null, 2);
        fs.writeFileSync(path.join(buildDir, 'src/content/pages/home.md'), `---\n${homeFrontmatter}\n---\n`);

        console.log('    ✓ Data files written');

        // 5. Build
        console.log('    ⟳ Building...');
        execSync('npm run build', { cwd: buildDir, stdio: 'pipe' });
        console.log('    ✓ Build complete');
      }

      // 6. Deploy (skip if no Cloudflare credentials)
      let deployedUrl = '';
      if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
        deployedUrl = deploy(buildDir, prospect);
        console.log(`    ✓ Deployed → ${deployedUrl}`);
      } else {
        console.log('    ⚠ Skipping deploy — CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not set');
        console.log(`    → Built files are in: ${path.join(buildDir, 'dist')}`);
      }

      setField(records, prospect.id, 'status', 'completed');
      setField(records, prospect.id, 'deployed_url', deployedUrl);

    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}`);
      setField(records, prospect.id, 'status', 'failed');
    }

    // Save after every prospect so progress is never lost
    saveCSV(records);
  }

  const completed = records.filter(r => r.status === 'completed').length;
  const failed    = records.filter(r => r.status === 'failed').length;
  console.log(`\n✓  Done — ${completed} deployed, ${failed} failed\n`);
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
