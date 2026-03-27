import type { Block } from 'payload'

export const ReviewsBlock: Block = {
  slug: 'reviews',
  imageURL: 'https://picsum.photos/seed/reviews-block/480/320',
  imageAltText: 'Beoordelingen sectie voorbeeld',
  interfaceName: 'ReviewsBlock',
  fields: [
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
      label: 'Beoordelingen',
      type: 'array',
      fields: [
        {
          name: 'name',
          label: 'Naam',
          type: 'text',
        },
        {
          name: 'stars',
          label: 'Sterren',
          type: 'number',
          min: 1,
          max: 5,
        },
        {
          name: 'date',
          label: 'Datum',
          type: 'text',
        },
        {
          name: 'text',
          label: 'Recensietekst',
          type: 'textarea',
        },
      ],
    },
  ],
}
