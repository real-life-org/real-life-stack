import { defineRouteMiddleware } from '@astrojs/starlight/route-data'

/**
 * Vorschau fuer geteilte Links: Starlight setzt Titel, Beschreibung und Adresse als Open-Graph-Tags,
 * aber kein Bild; ohne `og:image` zeigen Messenger und soziale Netze nur einen Textlink. Deutsch bekommt
 * das deutsche Bild, alle anderen Sprachen das englische (Quelle: apps/site/og/vorschau.html).
 * Die Startseiten sind Website, nicht Artikel.
 */
export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute
  const de = route.lang === 'de'
  const bild = new URL(`/og/${de ? 'de' : 'en'}.png`, context.site).href
  const alt = de
    ? 'Real Life Stack: Der Baukasten für lokale Vernetzung, daneben die App eines Gemeinschaftsgartens auf dem Telefon'
    : 'Real Life Stack: Your toolkit for local connection, next to a community garden app on a phone'
  const meta = (attrs: Record<string, string>) => route.head.push({ tag: 'meta', attrs })
  meta({ property: 'og:image', content: bild })
  meta({ property: 'og:image:width', content: '1200' })
  meta({ property: 'og:image:height', content: '630' })
  meta({ property: 'og:image:type', content: 'image/png' })
  meta({ property: 'og:image:alt', content: alt })
  meta({ name: 'twitter:image', content: bild })
  meta({ name: 'twitter:image:alt', content: alt })
  if (route.entry.data.template === 'splash') {
    const typ = route.head.find((t) => t.tag === 'meta' && t.attrs?.property === 'og:type')
    if (typ?.attrs) typ.attrs.content = 'website'
  }
})
