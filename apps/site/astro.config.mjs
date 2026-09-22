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
      description: 'Modularer Baukasten für lokale Vernetzung — Handbuch, Storybook, App.',
      defaultLocale: 'root',
      locales: LOCALES,
      customCss: ['./src/styles/site.css'],
      components: { Footer: './src/components/Footer.astro' },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/real-life-org/real-life-stack' },
      ],
      editLink: { baseUrl: 'https://github.com/real-life-org/real-life-stack/edit/master/docs/handbook/' },
      sidebar: [
        { label: 'Handbuch', translations: { en: 'Handbook' }, items: [{ autogenerate: { directory: 'handbuch' } }] },
        { label: 'Storybook', link: 'https://real-life-stack.de/storybook/', attrs: { target: '_self' } },
        { label: 'App', link: 'https://real-life-stack.de/app/', attrs: { target: '_self' } },
      ],
    }),
  ],
})
