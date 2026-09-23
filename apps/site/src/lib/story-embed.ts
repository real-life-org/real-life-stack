/** Adresse des Storybooks: im Dev-Modus das laufende (6006), gebaut `/storybook/`. */
export function storybookBase(): string {
  return import.meta.env.PUBLIC_STORYBOOK_URL || (import.meta.env.DEV ? 'http://localhost:6006' : '/storybook')
}

/** Die Story allein, ohne Storybook-Oberfläche; das Farbschema hängt das Skript an. */
export function storyFrameUrl(id: string): string {
  return `${storybookBase()}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`
}

/**
 * Die App-Vorschau rechts im Hero der Startseite: dieselbe Einbettung wie im Handbuch, als HTML-Zeichenkette,
 * weil Starlights Hero sein Bild nur so entgegennimmt (`hero.image.html`). Nur das Telefon, fest verkleinert,
 * ohne Umschalter; das Skript `story-frames` belebt sie.
 */
export function heroPreviewHtml(lang: string): string {
  const title = lang === 'de' ? 'Ein Gemeinschaftsgarten als App auf Real Life Stack' : 'A community garden as an app on Real Life Stack'
  return (
    `<figure class="story-example hero-story not-content" data-frame="phone" data-scale="0.7">` +
    `<div class="story-stage"><iframe data-src="${storyFrameUrl('rls-app-00-community-garden--garden')}" title="${title}" loading="lazy" allow="fullscreen"></iframe></div>` +
    `</figure>`
  )
}
