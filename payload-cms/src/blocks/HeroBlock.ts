import type { Block } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const HeroBlock: Block = {
  slug: 'hero',
  imageURL: 'https://picsum.photos/seed/hero-block/480/320',
  imageAltText: 'Hero sectie voorbeeld',
  interfaceName: 'HeroBlock',
  fields: [
    {
      name: 'eyebrow',
      label: 'Bovenkop',
      type: 'text',
    },
    {
      name: 'headline',
      label: 'Hoofdtitel',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      label: 'Omschrijving',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [...defaultFeatures],
      }),
    },
    {
      name: 'ctaPrimary',
      label: 'Knop 1 tekst',
      type: 'text',
      defaultValue: 'Maak een afspraak',
    },
    {
      name: 'ctaSecondary',
      label: 'Knop 2 tekst',
      type: 'text',
      defaultValue: 'Bel ons',
    },
    {
      name: 'imageUrl',
      label: 'Afbeelding URL',
      type: 'text',
    },
  ],
}
