import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

/**
 * real-life-stack.de aus einem Guss: Landing, Handbuch und der Verweis auf
 * Storybook und App in einer Site (Plan 22.09.2026). Das Handbuch liegt in
 * `docs/handbook/<sprache>/` und wird im PR wie die Spec gelesen; die Site
 * rendert es nur. Deutsch ist die Wurzel, jede weitere Sprache ein Präfix.
 */
export const LOCALES = {
  root: { label: 'Deutsch', lang: 'de' },
  en: { label: 'English', lang: 'en' },
  fr: { label: 'Français', lang: 'fr' },
  es: { label: 'Español', lang: 'es' },
  pt: { label: 'Português', lang: 'pt' },
  it: { label: 'Italiano', lang: 'it' },
  tr: { label: 'Türkçe', lang: 'tr' },
  ar: { label: 'العربية', lang: 'ar', dir: 'rtl' },
  zh: { label: '中文', lang: 'zh' },
  ru: { label: 'Русский', lang: 'ru' },
  uk: { label: 'Українська', lang: 'uk' },
  he: { label: 'עברית', lang: 'he', dir: 'rtl' },
}

/**
 * Die Handbuchseiten für die Seitenleiste, aus `docs/handbook/de/handbuch/`.
 * Starlights `autogenerate` findet sie nicht: Es liest den Dateipfad relativ zu
 * `src/content/docs`, und das Handbuch liegt bewusst außerhalb der Site. Also
 * lesen wir die Verzeichnisliste selbst — Titel und `sidebar.order` aus dem
 * Frontmatter, Übersicht zuerst. Andere Sprachen zeigen ihre Übersetzung,
 * wo es eine gibt, sonst die deutsche Seite — darum kein eigenes `label`.
 */
function handbookItems() {
  const dir = new URL('../../docs/handbook/de/handbuch/', import.meta.url)
  return readdirSync(dir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => {
      const text = readFileSync(new URL(f, dir), 'utf8')
      const id = f.replace(/\.mdx?$/, '')
      const title = text.match(/^title:\s*(.+)$/m)?.[1]?.trim().replace(/^(['"])(.*)\1$/, '$2') ?? id
      const order = id === 'index' ? -1 : Number(text.match(/^sidebar:\n\s+order:\s*(\d+)/m)?.[1] ?? 99)
      // Ohne `label`: Starlight nimmt den Titel der Seite in der jeweiligen Sprache (die Uebersetzung, wo es eine gibt).
      return { slug: `handbuch/${id}`, order, title }
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map(({ order, title, ...item }) => item)
}

export default defineConfig({
  site: 'https://real-life-stack.de',
  trailingSlash: 'always',
  redirects: {
    '/privacy': '/datenschutz/',
    '/privacy.html': '/datenschutz/',
    '/docs': '/handbuch/',
    '/docs/de': '/handbuch/',
  },
  // Die Handbuchseiten liegen ausserhalb der Site (docs/handbook); Bausteine
  // erreichen sie ueber diesen Alias statt ueber relative Pfade.
  vite: { resolve: { alias: { '@site': fileURLToPath(new URL('./src', import.meta.url)) } } },
  integrations: [
    starlight({
      title: 'Real Life Stack',
      description: 'Der Baukasten für lokale Vernetzung: Handbuch, Storybook, App.',
      defaultLocale: 'root',
      locales: LOCALES,
      customCss: ['./src/styles/site.css'],
      components: { Footer: './src/components/Footer.astro' },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/real-life-org/real-life-stack' },
      ],
      editLink: { baseUrl: 'https://github.com/real-life-org/real-life-stack/edit/master/docs/handbook/' },
      sidebar: [
        { label: 'Handbuch', translations: { en: 'Handbook' }, items: handbookItems() },
        // Die Referenz ist Englisch wie ihre Quellen (Hook-Kommentare, package.json, Spec-Index) und liegt als Astro-Seiten ausserhalb der Sammlung.
        { label: 'Referenz', translations: { en: 'Reference' }, items: [
          { label: 'Überblick', translations: { en: 'Overview' }, link: '/reference/' },
          { label: 'Hooks', link: '/reference/hooks/' },
          { label: 'Pakete', translations: { en: 'Packages' }, link: '/reference/packages/' },
          { label: 'Spezifikation', translations: { en: 'Specification' }, link: '/reference/spec/' },
        ] },
        { label: 'Storybook', link: 'https://real-life-stack.de/storybook/', attrs: { target: '_self' } },
        { label: 'App', link: 'https://real-life-stack.de/app/', attrs: { target: '_self' } },
      ],
    }),
  ],
})
