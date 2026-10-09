import './storybook.css'
// MapLibre bringt sein Stylesheet nicht selbst mit; ohne es sind Zoom-Knoepfe und Attribution unsichtbar.
// Die Apps importieren es in main.tsx, hier gilt es fuer alle Stories mit Karte.
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Preview } from '@storybook/react-vite'
import React from 'react'
import { setLanguage, type Language } from '../src/i18n'

/**
 * Eingebettet (Handbuch, Startseite) meldet die Vorschau dem Elternfenster, wenn
 * jemand ueber ihr scrollt. Rad, Wischen und Tasten bleiben im Iframe; erreicht
 * die Bewegung per Scroll-Chaining die Seite darunter, kann die den Ursprung
 * sonst nicht von einem Fokus-Sprung unterscheiden und nimmt sie zurueck.
 */
const MELDER = '__rlsStoryScrollMelder'
if (typeof window !== 'undefined' && window.parent !== window && !(MELDER in window)) {
  // Merker am Fenster: Storybooks HMR fuehrt dieses Modul erneut aus, die Listener sollen nur einmal haengen.
  ;(window as unknown as Record<string, boolean>)[MELDER] = true
  const melde = () => window.parent.postMessage({ type: 'rls-story-scroll' }, '*')
  // Nicht passiv, mit Absicht: Bei passiven Listenern scrollt der Browser schon auf dem Compositor, bevor das
  // Ereignis hier ankommt, und die Meldung traefe nach dem Scroll-Ereignis der Seite ein. So wartet er auf uns.
  for (const ereignis of ['wheel', 'touchstart', 'touchmove', 'keydown'])
    window.addEventListener(ereignis, melde, { passive: false, capture: true })
}

/**
 * Hell und Dunkel als EIN Signal.
 *
 * Vorher hing der Dunkelmodus am Hintergrund-Addon, und der Dekorator verglich
 * dessen Wert mit einem oklch-String — das Addon liefert aber den Schlüssel
 * ("dark"). Der Vergleich stimmte nie, die `dark`-Klasse kam nie an: Die
 * Leinwand wurde dunkel, die Bausteine blieben hell.
 *
 * Jetzt gibt es einen eigenen Umschalter, und er setzt die Klasse dort, wo die
 * App sie auch setzt: am Wurzelelement. Nur so folgt auch, was das Schema in
 * JavaScript liest (`resolveColorScheme`, `observeColorScheme` — die Karte).
 * Die Leinwand nimmt ihre Farbe aus demselben Token statt aus einer zweiten
 * Liste.
 */
function useSchema(dark: boolean) {
  React.useEffect(() => {
    const wurzel = document.documentElement
    wurzel.classList.toggle('dark', dark)
    // Beide Signale wie in der App (`applyColorScheme`): sonst zeigte eine Story
    // mit dem Umschalter data-theme="light" unter der dunklen Klasse.
    wurzel.setAttribute('data-theme', dark ? 'dark' : 'light')
    // Kein `style.colorScheme` inline: Das stach die `.dark { color-scheme: dark }`
    // der Tokens aus, und nach einem Klick auf den Umschalter malte der Browser
    // Scrollleisten und Formularfelder weiter im alten Schema (Codex zu #573).
    document.body.style.background = 'var(--background)'
    return () => {
      wurzel.classList.remove('dark')
      wurzel.removeAttribute('data-theme')
    }
  }, [dark])
}

/**
 * Die Sprache des Toolkits (i18n) als Umschalter. Deutsch vorweg: die
 * Beispieldaten der Stories sind deutsch, und eine Oberfläche in der Sprache
 * des Browsers neben deutschen Daten läse sich wie ein Fehler.
 */
function useSprache(language: Language) {
  React.useEffect(() => {
    setLanguage(language)
  }, [language])
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // Kein Hintergrund-Addon: Die Leinwand folgt dem Token, nicht einer
    // zweiten Farbliste, die mit ihm auseinanderlaufen kann.
    backgrounds: { disable: true },
    options: {
      storySort: (a, b) => {
        const sections = ['Start', 'App', 'App shell', 'Spaces', 'Modules', 'Items', 'Foundations']
        const left = a.title.split('/'),
          right = b.title.split('/')
        for (let i = 0; i < Math.max(left.length, right.length); i++) {
          const x = left[i] ?? '',
            y = right[i] ?? ''
          if (x === y) continue
          if (i === 1) return sections.indexOf(x) - sections.indexOf(y)
          if (x === 'Overview') return -1
          if (y === 'Overview') return 1
          return x.localeCompare(y, 'de', { numeric: true })
        }
        return a.name.localeCompare(b.name, 'de', { numeric: true })
      },
    },
  },

  globalTypes: {
    language: {
      description: 'Toolkit language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'de', title: 'Deutsch' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
    theme: {
      description: 'Color scheme',
      toolbar: {
        title: 'Color scheme',
        icon: 'contrast',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (Story, context) => {
      useSchema(context.globals.theme === 'dark')
      useSprache(context.globals.language === 'en' ? 'en' : 'de')
      return (
        <div
          className={`font-sans bg-background text-foreground ${context.parameters.layout === 'fullscreen' ? '' : 'p-4'}`}
        >
          <Story />
        </div>
      )
    },
  ],

  initialGlobals: { theme: 'light', language: 'de' },
}

export default preview
