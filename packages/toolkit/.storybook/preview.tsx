import './storybook.css'
import type { Preview } from '@storybook/react-vite'
import React from 'react'

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
        dark: { name: 'dark', value: 'oklch(0.21 0.034 264.665)' },
      },
    },
    options: {
      storySort: (a, b) => {
        const sections = [
          'Einstieg',
          'App',
          'App Shell',
          'Spaces',
          'Module',
          'Items',
          'Grundlagen',
        ]
        const left = a.title.split('/'),
          right = b.title.split('/')
        for (let i = 0; i < Math.max(left.length, right.length); i++) {
          const x = left[i] ?? '',
            y = right[i] ?? ''
          if (x === y) continue
          if (i === 1) return sections.indexOf(x) - sections.indexOf(y)
          if (x === 'Übersicht') return -1
          if (y === 'Übersicht') return 1
          return x.localeCompare(y, 'de', { numeric: true })
        }
        return a.name.localeCompare(b.name, 'de', { numeric: true })
      },
    },
  },

  decorators: [
    (Story, context) => {
      const isDark =
        context.globals.backgrounds?.value === 'oklch(0.21 0.034 264.665)'
      return (
        <div
          className={`font-sans ${context.parameters.layout === 'fullscreen' ? '' : 'p-4'} ${isDark ? 'dark' : ''}`}
        >
          <Story />
        </div>
      )
    },
  ],

  initialGlobals: {
    backgrounds: {
      value: 'light',
    },
  },
}

export default preview
