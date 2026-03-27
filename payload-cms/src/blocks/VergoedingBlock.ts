import type { Block } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const VergoedingBlock: Block = {
  slug: 'vergoeding',
  imageURL: 'https://picsum.photos/seed/vergoeding-block/480/320',
  imageAltText: 'Vergoeding sectie voorbeeld',
  interfaceName: 'VergoedingBlock',
  fields: [
    {
      name: 'eyebrow',
      label: 'Bovenkop',
      type: 'text',
    },
    {
      name: 'title',
      label: 'Titel',
      type: 'text',
    },
    {
      name: 'intro',
      label: 'Introductie',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [...defaultFeatures],
      }),
    },
    {
      name: 'infoBlocks',
      label: 'Informatieblokken',
      type: 'array',
      fields: [
        {
          name: 'title',
          label: 'Titel',
          type: 'text',
        },
        {
          name: 'text',
          label: 'Tekst',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'insurers',
      label: 'Verzekeraars',
      type: 'array',
      fields: [
        {
          name: 'name',
          label: 'Naam verzekeraar',
          type: 'text',
        },
      ],
    },
    {
      name: 'cta',
      label: 'Knoptekst',
      type: 'text',
    },
  ],
}
