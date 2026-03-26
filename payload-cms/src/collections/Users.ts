import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      options: [
        { label: 'Super Admin (Operator)', value: 'super-admin' },
        { label: 'Client', value: 'user' },
      ],
      access: {
        update: ({ req: { user } }) => (user as any)?.role === 'super-admin',
      },
    },
  ],
}
