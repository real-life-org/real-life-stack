import './storybook.css'
import type { Preview } from '@storybook/react-vite'
import React, { useEffect } from 'react'
import { ThemeTweaker } from '../src/components/theme-tweaker/theme-tweaker'

const DARK_BG = 'oklch(0.21 0.034 264.665)'

/**
 * Die Design-Regler neben der Story — ein Schalter in der Toolbar, damit
 * jede Komponente unter veraenderten Tokens angesehen werden kann, ohne
 * dass ihre Story davon wissen muss.
 */
function TweakerDock({ isDark }: { isDark: boolean }) {
  // Die Regler lesen die Tokens am Wurzelelement und folgen dessen
  // `dark`-Klasse (wie in der App). Der Dekorator setzt sie darum auch dort,
  // nicht nur am Wrapper der Story.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])
  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-[400px] overflow-y-auto border-l border-border bg-background text-foreground shadow-xl">
      <ThemeTweaker onToggleScheme={() => document.documentElement.classList.toggle('dark')} />
    </aside>
  )
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      options: {
        light: { name: 'light', value: 'oklch(0.985 0.002 247.839)' },
        dark: { name: 'dark', value: DARK_BG }
      }
    },
    options: {
      storySort: {
        order: [
          'RLS',
          ['App Shell', 'Space Modules', 'Module Components', 'Primitives'],
        ],
      },
    },
  },

  globalTypes: {
    themeTweaker: {
      description: 'Design-Regler neben der Story',
      toolbar: {
        title: 'Regler',
        icon: 'paintbrush',
        items: [
          { value: 'off', title: 'Regler aus' },
          { value: 'on', title: 'Regler an' },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (Story, context) => {
      const isDark = context.globals.backgrounds?.value === DARK_BG
      const tweaker = context.globals.themeTweaker === 'on'
      return (
        <>
          <div
            className={`font-sans p-4 ${isDark ? 'dark' : ''}`}
            style={tweaker ? { marginRight: 400 } : undefined}
          >
            <Story />
          </div>
          {tweaker && <TweakerDock isDark={isDark} />}
        </>
      )
    },
  ],

  initialGlobals: {
    backgrounds: {
      value: 'light'
    },
    themeTweaker: 'off',
  }
}

export default preview
