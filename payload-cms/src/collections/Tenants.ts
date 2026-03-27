import type { CollectionConfig } from 'payload'

const isSuperAdmin = ({ req: { user } }: { req: { user: any } }) =>
  (user as any)?.role === 'super-admin'

// Read must stay open for logged-in users — the multiTenantPlugin fetches the
// Tenants collection internally to build the tenant switcher UI. Blocking read
// entirely crashes the admin panel for client users. Nav visibility is handled
// by admin.hidden below.
const isLoggedIn = ({ req: { user } }: { req: { user: any } }) => Boolean(user)

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    hidden: ({ user }) => (user as any)?.role !== 'super-admin',
  },
  access: {
    read: isLoggedIn,
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
