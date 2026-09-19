import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import type { StorybookConfig } from '@storybook/react-vite'
import tailwindcss from '@tailwindcss/vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [getAbsolutePath('@storybook/addon-docs')],
  framework: getAbsolutePath('@storybook/react-vite'),
  viteFinal: (config) => {
    // Storybook does not publish library declarations.
    config.plugins = (config.plugins || []).filter(
      (plugin) => !plugin || !('name' in plugin) || plugin.name !== 'vite:dts',
    )
    config.plugins.push(tailwindcss())

    // Suppress "use client" and sourcemap warnings from shadcn/ui + Radix UI
    const existingOnwarn = config.build?.rollupOptions?.onwarn
    config.build = config.build || {}
    config.build.rollupOptions = config.build.rollupOptions || {}
    config.build.rollupOptions.onwarn = (warning, warn) => {
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
      if (warning.message?.includes('sourcemap')) return
      if (existingOnwarn) existingOnwarn(warning, warn)
      else warn(warning)
    }

    return config
  },
}

export default config

function getAbsolutePath(value: string): any {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)))
}
