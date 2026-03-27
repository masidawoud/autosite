import type { CollectionConfig } from 'payload'

const isSuperAdmin = ({ req: { user } }: { req: { user: any } }) =>
  (user as any)?.role === 'super-admin'

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    hidden: ({ user }) => (user as any)?.role !== 'super-admin',
  },
  access: {
    read: isSuperAdmin,
    create: isSuperAdmin,
    update: isSuperAdmin,
    delete: isSuperAdmin,
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
