import { defineCollection, z } from 'astro:content';

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title:           z.string(),
    seo_title:       z.string().optional(),
    seo_description: z.string().optional(),
    published:       z.boolean().default(true),
  }),
});

export const collections = { pages };
