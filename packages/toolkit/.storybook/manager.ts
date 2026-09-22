import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming'

/**
 * Das Storybook ist Teil von real-life-stack.de: Marke und Rueckweg wie auf
 * der Site, das Orange des Toolkits. Die Leinwand der Stories folgt ohnehin
 * den Tokens (preview.tsx); hier geht es um den Rahmen des Storybooks selbst.
 */
addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'Real Life Stack · Storybook',
    brandUrl: 'https://real-life-stack.de/',
    brandTarget: '_self',
    colorPrimary: '#c9702a',
    colorSecondary: '#c9702a',
    fontBase: 'Inter, system-ui, sans-serif',
    fontCode: '"Source Code Pro", ui-monospace, monospace',
  }),
})
