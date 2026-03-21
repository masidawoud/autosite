import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyBusinessFields, reconstructTheme, transformPages } from './content-transform.js'

const baseSiteJson = {
  meta: { title: 'Old Title', description: 'Old desc' },
  business: {
    name: 'Old Name',
    city: 'Old City',
    address: 'Old Address',
    postal_code: '1234 AB',
    phone: '010 000 0000',
    email: 'old@example.com',
    google_reviews_score: '4.8',
    google_reviews_count: 100,
    google_reviews_url: '#',
  },
  hero: { headline: 'Old headline' },
}

const siteConfig = {
  client_id: 'tandarts-test',
  business_name: 'Tandarts Test',
  phone: '020 123 4567',
  email: 'info@tandarts-test.nl',
  address: 'Teststraat 1',
  city: 'Amsterdam',
  postal_code: '1000 AA',
  theme_preset: 'warm-editorial',
  theme_accent_1: '#FF0000',
  theme_accent_2: '#CC0000',
}

const warmEditorialPreset = {
  preset: 'warm-editorial',
  fonts: {
    display_family: 'Cormorant Garamond',
    display_url: 'Cormorant+Garamond:ital,wght@0,400',
    body_family: 'DM Sans',
    body_url: 'DM+Sans:ital,opsz,wght@0,9..40,300',
    display_fallback: 'Georgia, serif',
    body_fallback: 'system-ui, sans-serif',
  },
  colors: {
    accent: '#2D7A6C',
    accent_hover: '#226359',
    accent_light: '#EBF5F2',
    bg: '#FAF7F2',
    bg_alt: '#F0E9DE',
    bg_dark: '#1C1917',
    text: '#1C1917',
    text_muted: '#78716C',
    text_light: '#FAF7F2',
    border: '#E5DDD3',
    star: '#F5A623',
  },
  radius: { sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2.5rem' },
}

describe('applyBusinessFields', () => {
  it('overrides business fields from siteConfig', () => {
    const result = applyBusinessFields(baseSiteJson, siteConfig)
    assert.equal(result.business.name, 'Tandarts Test')
    assert.equal(result.business.phone, '020 123 4567')
    assert.equal(result.business.email, 'info@tandarts-test.nl')
    assert.equal(result.business.address, 'Teststraat 1')
    assert.equal(result.business.city, 'Amsterdam')
    assert.equal(result.business.postal_code, '1000 AA')
  })

  it('preserves non-business fields unchanged', () => {
    const result = applyBusinessFields(baseSiteJson, siteConfig)
    assert.deepEqual(result.hero, baseSiteJson.hero)
    assert.deepEqual(result.meta, baseSiteJson.meta)
  })

  it('preserves existing google_reviews fields', () => {
    const result = applyBusinessFields(baseSiteJson, siteConfig)
    assert.equal(result.business.google_reviews_score, '4.8')
    assert.equal(result.business.google_reviews_count, 100)
  })
})

describe('reconstructTheme', () => {
  it('overrides accent colors from siteConfig', () => {
    const result = reconstructTheme(siteConfig, { 'warm-editorial': warmEditorialPreset })
    assert.equal(result.colors.accent, '#FF0000')
    assert.equal(result.colors.accent_hover, '#CC0000')
  })

  it('preserves non-accent colors from preset', () => {
    const result = reconstructTheme(siteConfig, { 'warm-editorial': warmEditorialPreset })
    assert.equal(result.colors.bg, '#FAF7F2')
    assert.equal(result.colors.text, '#1C1917')
  })

  it('preserves fonts and radius from preset', () => {
    const result = reconstructTheme(siteConfig, { 'warm-editorial': warmEditorialPreset })
    assert.deepEqual(result.fonts, warmEditorialPreset.fonts)
    assert.deepEqual(result.radius, warmEditorialPreset.radius)
  })

  it('calculates accent_light by lightening accent color', () => {
    const result = reconstructTheme(siteConfig, { 'warm-editorial': warmEditorialPreset })
    // #FF0000 lightened 85% toward white: r=255, g=round(0+255*0.85)=217, b=round(0+255*0.85)=217
    assert.equal(result.colors.accent_light, '#ffd9d9')
  })

  it('uses the correct preset from siteConfig.theme_preset', () => {
    const result = reconstructTheme(siteConfig, { 'warm-editorial': warmEditorialPreset })
    assert.equal(result.preset, 'warm-editorial')
  })
})

// Simulated Directus pages API response (two pages, one with two blocks)
const rawPages = [
  {
    id: 'uuid-1',
    title: 'Over Ons',
    slug: 'over-ons',
    status: 'published',
    blocks: [
      {
        sort: 2,
        collection: 'block_quote',
        item: { id: 'uuid-q1', text: 'Great care.', author_name: 'Dr. A', author_role: 'Tandarts', owner: 'user-uuid' }
      },
      {
        sort: 1,
        collection: 'block_hero',
        item: { id: 'uuid-h1', headline: 'Over Ons', eyebrow: 'Team', description: 'Wij zijn...', owner: 'user-uuid' }
      },
    ]
  },
  {
    id: 'uuid-2',
    title: 'Diensten',
    slug: 'diensten',
    status: 'published',
    blocks: []
  },
]

describe('transformPages', () => {
  it('returns one entry per page', () => {
    const result = transformPages(rawPages)
    assert.equal(result.length, 2)
  })

  it('preserves slug, title, status', () => {
    const result = transformPages(rawPages)
    assert.equal(result[0].slug, 'over-ons')
    assert.equal(result[0].title, 'Over Ons')
    assert.equal(result[0].status, 'published')
  })

  it('sorts blocks by sort field ascending', () => {
    const result = transformPages(rawPages)
    const blocks = result[0].blocks
    assert.equal(blocks[0].collection, 'block_hero')   // sort: 1
    assert.equal(blocks[1].collection, 'block_quote')  // sort: 2
  })

  it('strips owner and id from block items', () => {
    const result = transformPages(rawPages)
    const heroItem = result[0].blocks[0].item
    assert.equal(heroItem.owner, undefined)
    assert.equal(heroItem.id, undefined)
    assert.equal(heroItem.headline, 'Over Ons')
  })

  it('handles page with no blocks', () => {
    const result = transformPages(rawPages)
    assert.deepEqual(result[1].blocks, [])
  })
})
