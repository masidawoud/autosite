import type { Block } from 'payload'

export const QuoteBlock: Block = {
  slug: 'quote',
  imageURL: 'https://picsum.photos/seed/quote-block/480/320',
  imageAltText: 'Citaat sectie voorbeeld',
  interfaceName: 'QuoteBlock',
  fields: [
    {
      name: 'text',
      label: 'Citaattekst',
      type: 'textarea',
    },
    {
      name: 'authorName',
      label: 'Naam auteur',
      type: 'text',
    },
    {
      name: 'authorRole',
      label: 'Functie auteur',
      type: 'text',
    },
  ],
}
