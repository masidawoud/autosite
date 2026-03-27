import type { Block } from 'payload'

export const HoursBlock: Block = {
  slug: 'hours',
  imageURL: 'https://picsum.photos/seed/hours-block/480/320',
  imageAltText: 'Openingstijden sectie voorbeeld',
  interfaceName: 'HoursBlock',
  fields: [
    {
      name: 'items',
      label: 'Dagen',
      type: 'array',
      fields: [
        {
          name: 'day',
          label: 'Dag',
          type: 'text',
        },
        {
          name: 'time',
          label: 'Tijden',
          type: 'text',
        },
        {
          name: 'open',
          label: 'Open?',
          type: 'checkbox',
          defaultValue: true,
        },
      ],
    },
  ],
}
