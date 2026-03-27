import type { CollectionConfig } from 'payload'
import { HeroBlock } from '../blocks/HeroBlock'
import { QuoteBlock } from '../blocks/QuoteBlock'
import { FeaturesBlock } from '../blocks/FeaturesBlock'
import { ServicesBlock } from '../blocks/ServicesBlock'
import { TeamBlock } from '../blocks/TeamBlock'
import { ReviewsBlock } from '../blocks/ReviewsBlock'
import { HoursBlock } from '../blocks/HoursBlock'
import { VergoedingBlock } from '../blocks/VergoedingBlock'
import { ContactBlock } from '../blocks/ContactBlock'

const GITHUB_REPO = 'masidawoud/autosite'
const WORKFLOW_FILE = 'build-from-payload.yml'

const isSuperAdmin = ({ req: { user } }: any) => (user as any)?.role === 'super-admin'
const isLoggedIn = ({ req: { user } }: any) => Boolean(user)

async function dispatchBuild(slug: string, cfPagesProject: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    console.warn('[DentalSites] GITHUB_TOKEN is not set — skipping build dispatch')
    return
  }

  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`
  const body = JSON.stringify({
    ref: 'master',
    inputs: { client_id: slug, cf_project_name: cfPagesProject },
  })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'autosite-payload-cms',
      },
      body,
    })
    if (res.ok || res.status === 204) {
      console.log(`[DentalSites] Build dispatched for tenant="${slug}" cf_project="${cfPagesProject}"`)
    } else {
      const text = await res.text()
      console.error(`[DentalSites] GitHub dispatch failed — status=${res.status} body=${text}`)
    }
  } catch (err) {
    console.error('[DentalSites] GitHub dispatch fetch threw:', err)
  }
}

export const DentalSites: CollectionConfig = {
  slug: 'dental-sites',
  lockDocuments: false,
  admin: {
    useAsTitle: 'practiceName',
  },
  access: {
    create: isSuperAdmin,
    read: isLoggedIn,   // plugin further filters by tenant for non-admins
    update: isLoggedIn, // plugin further filters by tenant for non-admins
    delete: isSuperAdmin,
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'update') return

        try {
          // doc.tenant may be a populated object or just an id (number/string)
          let slug: string | undefined
          let cfPagesProject: string | undefined

          if (doc.tenant && typeof doc.tenant === 'object') {
            slug = doc.tenant.slug
            cfPagesProject = doc.tenant.cfPagesProject
          } else if (doc.tenant) {
            // Fetch the tenant record to get slug + cfPagesProject
            const tenant = await req.payload.findByID({
              collection: 'tenants',
              id: doc.tenant,
              overrideAccess: true,
            })
            slug = (tenant as any)?.slug
            cfPagesProject = (tenant as any)?.cfPagesProject
          }

          if (!slug || !cfPagesProject) {
            console.warn('[DentalSites] afterChange: tenant slug or cfPagesProject missing — skipping dispatch', {
              docId: doc.id,
              tenant: doc.tenant,
            })
            return
          }

          // Must await — Cloudflare Workers kill pending promises after response is sent
          await dispatchBuild(slug, cfPagesProject)
        } catch (err) {
          console.error('[DentalSites] afterChange hook error:', err)
        }
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        // ── Tab 1: Pagina-inhoud ─────────────────────────────────────────────
        {
          label: 'Pagina-inhoud',
          fields: [
            {
              name: 'sections',
              label: 'Secties',
              type: 'blocks',
              minRows: 0,
              maxRows: 20,
              blocks: [
                HeroBlock,
                QuoteBlock,
                FeaturesBlock,
                ServicesBlock,
                TeamBlock,
                ReviewsBlock,
                HoursBlock,
                VergoedingBlock,
                ContactBlock,
              ],
            },
          ],
        },

        // ── Tab 2: Bedrijfsgegevens ──────────────────────────────────────────
        {
          label: 'Bedrijfsgegevens',
          fields: [
            {
              name: 'practiceName',
              label: 'Practice Name',
              type: 'text',
              required: true,
            },
            {
              name: 'business',
              type: 'group',
              fields: [
                { name: 'city', type: 'text' },
                { name: 'address', type: 'text' },
                { name: 'postalCode', label: 'Postal Code', type: 'text' },
                { name: 'googleReviewsScore', label: 'Google Reviews Score', type: 'text' },
                { name: 'googleReviewsCount', label: 'Google Reviews Count', type: 'number' },
                { name: 'googleReviewsUrl', label: 'Google Reviews URL', type: 'text' },
              ],
            },
            {
              name: 'contact',
              type: 'group',
              fields: [
                { name: 'eyebrow', type: 'text' },
                { name: 'title', type: 'text' },
                { name: 'intro', type: 'textarea' },
                { name: 'phone', type: 'text' },
                { name: 'email', type: 'email' },
              ],
            },
          ],
        },

        // ── Tab 3: Thema ─────────────────────────────────────────────────────
        {
          label: 'Thema',
          fields: [
            {
              name: 'theme',
              type: 'group',
              fields: [
                {
                  name: 'stylePreset',
                  label: 'Style Preset',
                  type: 'select',
                  options: [
                    { label: 'Warm Editorial', value: 'warm-editorial' },
                    { label: 'Ocean Depths', value: 'ocean-depths' },
                    { label: 'Tech Innovation', value: 'tech-innovation' },
                  ],
                },
                { name: 'accentColor', label: 'Accent Color (hex)', type: 'text', admin: { placeholder: '#2D7A6C' } },
                { name: 'accentHoverColor', label: 'Accent Hover Color (hex)', type: 'text' },
              ],
            },
          ],
        },

        // ── Tab 4: SEO & Footer ──────────────────────────────────────────────
        {
          label: 'SEO & Footer',
          fields: [
            {
              name: 'footer',
              type: 'group',
              fields: [
                { name: 'metaTitle', label: 'Meta Title', type: 'text' },
                { name: 'metaDescription', label: 'Meta Description', type: 'textarea' },
                { name: 'tagline', type: 'text' },
              ],
            },
          ],
        },
      ],
    },
  ],
}
