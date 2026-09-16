import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'
import { docsSchema } from '@astrojs/starlight/schema'

export const collections = {
  docs: defineCollection({
    loader: glob({
      base: '../../docs/handbook',
      pattern:
        process.env.HANDBOOK_PREVIEW_EN === '1'
          ? '{de,en}/**/*.{md,mdx}'
          : 'de/**/*.{md,mdx}',
    }),
    schema: docsSchema({
      extend: z.object({
        sources: z.array(z.string()).min(1),
        terms: z.array(z.string()).default([]),
        stories: z.array(z.string()).default([]),
        translationOf: z.string().optional(),
        sourceHash: z.string().optional(),
      }),
    }),
  }),
}
