import type { CollectionConfig } from 'payload'

const isSuperAdmin = ({ req: { user } }: any) => (user as any)?.role === 'super-admin'
const isLoggedIn = ({ req: { user } }: any) => Boolean(user)

export const DentalSites: CollectionConfig = {
  slug: 'dental-sites',
  admin: {
    useAsTitle: 'practiceName',
  },
  access: {
    create: isSuperAdmin,
    read: isLoggedIn,   // plugin further filters by tenant for non-admins
    update: isLoggedIn, // plugin further filters by tenant for non-admins
    delete: isSuperAdmin,
  },
  fields: [
    {
      name: 'practiceName',
      label: 'Practice Name',
      type: 'text',
      required: true,
    },
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'headlineLight', label: 'Headline (light text)', type: 'text' },
        { name: 'headlineHeavy', label: 'Headline (bold text)', type: 'text' },
        { name: 'subtext', label: 'Subtext / description', type: 'textarea' },
        { name: 'cta', label: 'CTA Button Text', type: 'text', defaultValue: 'Maak een afspraak' },
      ],
    },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'hours', label: 'Opening hours (short)', type: 'text' },
      ],
    },
    {
      name: 'services',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'textarea' },
      ],
    },
  ],
}
