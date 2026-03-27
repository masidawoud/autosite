import type { Block } from 'payload'

export const FeaturesBlock: Block = {
  slug: 'features',
  imageURL: 'https://picsum.photos/seed/features-block/480/320',
  imageAltText: 'Voordelen sectie voorbeeld',
  interfaceName: 'FeaturesBlock',
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
      name: 'imageUrl',
      label: 'Afbeelding URL',
      type: 'text',
    },
    {
      name: 'items',
      label: 'Voordelen',
      type: 'array',
      fields: [
        {
          name: 'icon',
          label: 'Icoon',
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
        {
          name: 'title',
          label: 'Naam',
          type: 'text',
        },
        {
          name: 'desc',
          label: 'Beschrijving',
          type: 'textarea',
        },
      ],
    },
  ],
}
