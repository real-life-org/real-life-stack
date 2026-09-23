import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'
import { docsSchema } from '@astrojs/starlight/schema'

/**
 * Das Handbuch liegt im Repo unter `docs/handbook/<sprache>/…`, damit es im
 * PR wie die Spec gelesen wird. Deutsch ist die Wurzel-Sprache der Site: Der
 * Ordner `de/` fällt aus der Adresse, `en/` bleibt als Präfix.
 */
export const collections = {
  docs: defineCollection({
    loader: glob({
      base: '../../docs/handbook',
      pattern: '**/*.{md,mdx}',
      generateId: ({ entry }) => entry.replace(/\.(md|mdx)$/, '').replace(/^de\//, ''),
    }),
    schema: docsSchema({
      extend: z.object({
        /** Dateien im Repo, aus denen die Seite ihre Aussagen zieht — geprüft von `scripts/site/check.mjs`. */
        sources: z.array(z.string()).default([]),
        /** Story-Ids, die die Seite einbettet — geprüft gegen den Storybook-Index. */
        stories: z.array(z.string()).default([]),
        /** Gruppe in der Seitenleiste (`verstehen`, `betreiben`, `erweitern`); ohne Gruppe steht die Seite direkt unter „Handbuch“. Gelesen von `handbookItems()` in astro.config.mjs. */
        group: z.enum(['verstehen', 'betreiben', 'erweitern']).optional(),
        /** Für Übersetzungen: die deutsche Quelle und ihr Hash zum Zeitpunkt der Übersetzung. */
        translationOf: z.string().optional(),
        sourceHash: z.string().optional(),
      }),
    }),
  }),
}
