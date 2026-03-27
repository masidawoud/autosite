import type { Block } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const TeamBlock: Block = {
  slug: 'team',
  imageURL: 'https://picsum.photos/seed/team-block/480/320',
  imageAltText: 'Team sectie voorbeeld',
  interfaceName: 'TeamBlock',
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
      name: 'subtitle',
      label: 'Subtitel',
      type: 'textarea',
    },
    {
      name: 'members',
      label: 'Teamleden',
      type: 'array',
      fields: [
        {
          name: 'name',
          label: 'Naam',
          type: 'text',
        },
        {
          name: 'role',
          label: 'Functie',
          type: 'text',
        },
        {
          name: 'bio',
          label: 'Bio',
          type: 'richText',
          editor: lexicalEditor({
            features: ({ defaultFeatures }) => [...defaultFeatures],
          }),
        },
        {
          name: 'imageUrl',
          label: 'Foto URL',
          type: 'text',
        },
      ],
    },
  ],
}
