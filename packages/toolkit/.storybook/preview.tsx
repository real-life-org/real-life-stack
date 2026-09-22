import './storybook.css'
import type { Preview } from '@storybook/react-vite'
import React from 'react'

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
    wurzel.style.colorScheme = dark ? 'dark' : 'light'
    document.body.style.background = 'var(--background)'
    return () => {
      wurzel.classList.remove('dark')
      wurzel.style.colorScheme = ''
    }
  }, [dark])
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
      return (
        <div
          className={`font-sans bg-background text-foreground ${context.parameters.layout === 'fullscreen' ? '' : 'p-4'}`}
        >
          <Story />
        </div>
      )
    },
  ],

  initialGlobals: { theme: 'light' },
}

export default preview
