import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

const previewEnglish = process.env.HANDBOOK_PREVIEW_EN === '1'
export default defineConfig({
  site: 'https://real-life-stack.de',
  base: '/docs',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'Real Life Stack',
      description:
        'Ein Baukasten. Viele Gemeinschaften. Das Handbuch für Real Life Stack.',
      defaultLocale: 'de',
      locales: {
        de: { label: 'Deutsch', lang: 'de' },
        ...(previewEnglish
          ? { en: { label: 'English · Preview', lang: 'en' } }
          : {}),
      },
      customCss: ['./src/styles/handbook.css'],
      components: { Footer: './src/components/Footer.astro' },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/real-life-org/real-life-stack',
        },
      ],
      editLink: {
        baseUrl:
          'https://github.com/real-life-org/real-life-stack/edit/master/apps/docs/',
      },
      sidebar: [
        {
          label: 'Hier anfangen',
          items: [{ slug: 'index' }, { slug: 'system' }],
        },
        {
          label: 'Getting Started',
          items: [
            { slug: 'instanz' },
            { slug: 'entwickeln' },
            { slug: 'eigene-app' },
          ],
        },
        {
          label: 'Die Oberfläche verstehen',
          items: [
            { slug: 'oberflaeche' },
            { slug: 'item-detail' },
            { slug: 'rechte' },
          ],
        },
        {
          label: 'Mit dem Stack arbeiten',
          items: [
            { slug: 'datenfluss' },
            { slug: 'agenten' },
            { slug: 'beitragen' },
          ],
        },
        {
          label: 'Nachschlagen',
          items: [{ slug: 'glossar' }, { slug: 'pflege' }],
        },
      ],
    }),
  ],
})
