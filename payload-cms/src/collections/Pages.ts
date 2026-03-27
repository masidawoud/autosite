import type { CollectionConfig } from 'payload'
import { HeroBlock } from '../blocks/HeroBlock'
import { QuoteBlock } from '../blocks/QuoteBlock'
import { FeaturesBlock } from '../blocks/FeaturesBlock'
import { ServicesBlock } from '../blocks/ServicesBlock'
import { TeamBlock } from '../blocks/TeamBlock'
import { ReviewsBlock } from '../blocks/ReviewsBlock'
import { HoursBlock } from '../blocks/HoursBlock'
import { VergoedingBlock } from '../blocks/VergoedingBlock'
import { ContactBlock } from '../blocks/ContactBlock'
import { dispatchBuildForDoc } from '../lib/dispatchBuild'

const isSuperAdmin = ({ req: { user } }: any) => (user as any)?.role === 'super-admin'
const isLoggedIn = ({ req: { user } }: any) => Boolean(user)

export const Pages: CollectionConfig = {
  slug: 'pages',
  lockDocuments: false,
  admin: {
    useAsTitle: 'title',
    group: 'Inhoud',
  },
  access: {
    create: isSuperAdmin,
    read: isLoggedIn,
    update: isLoggedIn,
    delete: isSuperAdmin,
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'update') return
        await dispatchBuildForDoc(doc, req)
      },
    ],
  },
  fields: [
    {
      name: 'title',
      label: 'Paginatitel',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: 'Slug',
      type: 'text',
      required: true,
      admin: {
        description: 'URL-identifier, e.g. "home" or "over-ons". Use lowercase, no spaces.',
      },
    },
    {
      name: 'layout',
      label: 'Secties',
      type: 'blocks',
      minRows: 0,
      maxRows: 20,
      blocks: [
        HeroBlock,
        QuoteBlock,
        FeaturesBlock,
        ServicesBlock,
        TeamBlock,
        ReviewsBlock,
        HoursBlock,
        VergoedingBlock,
        ContactBlock,
      ],
    },
  ],
}
