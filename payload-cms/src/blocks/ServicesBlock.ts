import type { Block } from 'payload'

export const ServicesBlock: Block = {
  slug: 'services',
  imageURL: 'https://picsum.photos/seed/services-block/480/320',
  imageAltText: 'Behandelingen sectie voorbeeld',
  interfaceName: 'ServicesBlock',
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
      name: 'items',
      label: 'Behandelingen',
      type: 'array',
      fields: [
        {
          name: 'tag',
          label: 'Label',
          type: 'text',
        },
        {
          name: 'title',
          label: 'Naam',
          type: 'text',
        },
        {
          name: 'desc',
          label: 'Omschrijving',
          type: 'textarea',
        },
        {
          name: 'imageUrl',
          label: 'Afbeelding URL',
          type: 'text',
        },
        {
          name: 'bullets',
          label: 'Opsommingspunten',
          type: 'array',
          fields: [
            {
              name: 'text',
              label: 'Opsommingspunt',
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
    },
  ],
}
