import type { CollectionConfig } from 'payload'

const isSuperAdmin = ({ req: { user } }: any) => (user as any)?.role === 'super-admin'
const isLoggedIn = ({ req: { user } }: any) => Boolean(user)

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
  fields: [
    {
      name: 'practiceName',
      label: 'Practice Name',
      type: 'text',
      required: true,
    },

    // ── Business info ──────────────────────────────────────────────────────────
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

    // ── Hero ──────────────────────────────────────────────────────────────────
    {
      name: 'hero',
      type: 'group',
      fields: [
        { name: 'eyebrow', type: 'text' },
        { name: 'headline', type: 'text' },
        { name: 'description', type: 'textarea' },
        { name: 'ctaPrimary', label: 'CTA Primary', type: 'text', defaultValue: 'Maak een afspraak' },
        { name: 'ctaSecondary', label: 'CTA Secondary', type: 'text', defaultValue: 'Bel ons' },
        { name: 'imageUrl', label: 'Image URL', type: 'text' },
      ],
    },

    // ── Quote ─────────────────────────────────────────────────────────────────
    {
      name: 'quote',
      type: 'group',
      fields: [
        { name: 'text', type: 'textarea' },
        { name: 'authorName', label: 'Author Name', type: 'text' },
        { name: 'authorRole', label: 'Author Role', type: 'text' },
      ],
    },

    // ── Features ──────────────────────────────────────────────────────────────
    {
      name: 'features',
      type: 'group',
      fields: [
        { name: 'eyebrow', type: 'text' },
        { name: 'title', type: 'text' },
        { name: 'subtitle', type: 'text' },
        { name: 'imageUrl', label: 'Image URL', type: 'text' },
        {
          name: 'items',
          type: 'array',
          fields: [
            {
              name: 'icon',
              type: 'select',
              options: [
                { label: 'Shield', value: 'shield' },
                { label: 'Clock', value: 'clock' },
                { label: 'Team', value: 'team' },
                { label: 'Tech', value: 'tech' },
                { label: 'Heart', value: 'heart' },
                { label: 'Card', value: 'card' },
              ],
            },
            { name: 'title', type: 'text' },
            { name: 'desc', label: 'Description', type: 'textarea' },
          ],
        },
      ],
    },

    // ── Services ──────────────────────────────────────────────────────────────
    {
      name: 'services',
      type: 'group',
      fields: [
        { name: 'eyebrow', type: 'text' },
        { name: 'title', type: 'text' },
        { name: 'subtitle', type: 'text' },
        {
          name: 'items',
          type: 'array',
          fields: [
            { name: 'tag', type: 'text' },
            { name: 'title', type: 'text' },
            { name: 'desc', label: 'Description', type: 'textarea' },
            { name: 'imageUrl', label: 'Image URL', type: 'text' },
            {
              name: 'bulletsJson',
              label: 'Bullet Points (JSON)',
              type: 'json',
              admin: { description: 'JSON array of strings, e.g. ["Bullet 1", "Bullet 2"]' },
            },
            { name: 'cta', label: 'CTA Button', type: 'text' },
          ],
        },
      ],
    },

    // ── Team ──────────────────────────────────────────────────────────────────
    {
      name: 'team',
      type: 'group',
      fields: [
        { name: 'eyebrow', type: 'text' },
        { name: 'title', type: 'text' },
        { name: 'subtitle', type: 'text' },
        {
          name: 'members',
          type: 'array',
          fields: [
            { name: 'name', type: 'text' },
            { name: 'role', type: 'text' },
            { name: 'bio', type: 'textarea' },
            { name: 'imageUrl', label: 'Image URL', type: 'text' },
          ],
        },
      ],
    },

    // ── Reviews ───────────────────────────────────────────────────────────────
    {
      name: 'reviews',
      type: 'group',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'subtitle', type: 'text' },
        {
          name: 'items',
          type: 'array',
          fields: [
            { name: 'name', type: 'text' },
            { name: 'stars', type: 'number' },
            { name: 'date', type: 'text' },
            { name: 'text', type: 'textarea' },
          ],
        },
      ],
    },

    // ── Opening hours ─────────────────────────────────────────────────────────
    {
      name: 'hours',
      label: 'Opening Hours',
      type: 'group',
      fields: [
        {
          name: 'items',
          type: 'array',
          fields: [
            { name: 'day', type: 'text' },
            { name: 'time', type: 'text' },
            { name: 'open', type: 'checkbox', defaultValue: true },
          ],
        },
      ],
    },

    // ── Vergoeding ────────────────────────────────────────────────────────────
    {
      name: 'vergoeding',
      label: 'Vergoeding (Insurance)',
      type: 'group',
      fields: [
        { name: 'eyebrow', type: 'text' },
        { name: 'title', type: 'text' },
        { name: 'intro', type: 'textarea' },
        {
          name: 'blocks',
          type: 'array',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'text', type: 'textarea' },
          ],
        },
        {
          name: 'insurers',
          label: 'Insurer Names',
          type: 'array',
          fields: [
            { name: 'name', type: 'text' },
          ],
        },
        { name: 'cta', label: 'CTA Button', type: 'text' },
      ],
    },

    // ── Contact ───────────────────────────────────────────────────────────────
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

    // ── Footer / SEO ──────────────────────────────────────────────────────────
    {
      name: 'footer',
      type: 'group',
      fields: [
        { name: 'metaTitle', label: 'Meta Title', type: 'text' },
        { name: 'metaDescription', label: 'Meta Description', type: 'textarea' },
        { name: 'tagline', type: 'text' },
      ],
    },

    // ── Theme ─────────────────────────────────────────────────────────────────
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
}
