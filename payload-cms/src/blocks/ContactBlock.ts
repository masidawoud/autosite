import type { Block } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const ContactBlock: Block = {
  slug: 'contact',
  imageURL: 'https://picsum.photos/seed/contact-block/480/320',
  imageAltText: 'Contact sectie voorbeeld',
  interfaceName: 'ContactBlock',
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
  ],
}
