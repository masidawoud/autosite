import type { CollectionConfig } from 'payload'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description:
          'Used as the Cloudflare Pages project name suffix (e.g. lie-dental → dentist-lie-dental)',
      },
    },
    {
      name: 'cfPagesProject',
      label: 'Cloudflare Pages Project Name',
      type: 'text',
      required: true,
      admin: {
        description: 'Exact CF Pages project name (e.g. dentist-lie-dental)',
      },
    },
  ],
}
