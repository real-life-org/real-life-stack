import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    conditions: ['import', 'module', 'browser', 'default'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@real-life/toolkit': path.resolve(__dirname, '../../packages/toolkit/dist/index.js'),
      '@real-life/data-interface': path.resolve(__dirname, '../../packages/data-interface/src'),
      '@real-life/mock-connector': path.resolve(__dirname, '../../packages/mock-connector/src'),
    },
  },
})
