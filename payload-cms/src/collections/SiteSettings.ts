import type { CollectionConfig } from 'payload'
import { dispatchBuildForDoc } from '../lib/dispatchBuild'

const isSuperAdmin = ({ req: { user } }: any) => (user as any)?.role === 'super-admin'
const isLoggedIn = ({ req: { user } }: any) => Boolean(user)

export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  lockDocuments: false,
  admin: {
    useAsTitle: 'practiceName',
    group: 'Instellingen',
  },
  access: {
    create: isSuperAdmin,
    read: isLoggedIn,
    update: isLoggedIn,
    delete: isSuperAdmin,
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'update') return
        await dispatchBuildForDoc(doc, req)
      },
    ],
  },
  fields: [
    {
      name: 'practiceName',
      label: 'Praktijknaam',
      type: 'text',
      required: true,
    },
    {
      name: 'business',
      label: 'Bedrijfsgegevens',
      type: 'group',
      fields: [
        { name: 'city', label: 'Stad', type: 'text' },
        { name: 'address', label: 'Adres', type: 'text' },
        { name: 'postalCode', label: 'Postcode', type: 'text' },
        { name: 'googleReviewsScore', label: 'Google Reviews Score', type: 'text' },
        { name: 'googleReviewsCount', label: 'Google Reviews Aantal', type: 'number' },
        { name: 'googleReviewsUrl', label: 'Google Reviews URL', type: 'text' },
      ],
    },
    {
      name: 'contact',
      label: 'Contact',
      type: 'group',
      fields: [
        { name: 'phone', label: 'Telefoon', type: 'text' },
        { name: 'email', label: 'E-mailadres', type: 'email' },
      ],
    },
    {
      name: 'theme',
      label: 'Thema',
      type: 'group',
      fields: [
        {
          name: 'stylePreset',
          label: 'Stijl Preset',
          type: 'select',
          options: [
            { label: 'Warm Editorial', value: 'warm-editorial' },
            { label: 'Ocean Depths', value: 'ocean-depths' },
            { label: 'Tech Innovation', value: 'tech-innovation' },
          ],
        },
        {
          name: 'accentColor',
          label: 'Accentkleur (hex)',
          type: 'text',
          admin: { placeholder: '#2D7A6C' },
        },
        {
          name: 'accentHoverColor',
          label: 'Accentkleur Hover (hex)',
          type: 'text',
        },
      ],
    },
    {
      name: 'footer',
      label: 'SEO & Footer',
      type: 'group',
      fields: [
        { name: 'metaTitle', label: 'Meta Title', type: 'text' },
        { name: 'metaDescription', label: 'Meta Description', type: 'textarea' },
        { name: 'tagline', label: 'Tagline', type: 'text' },
      ],
    },
  ],
}
