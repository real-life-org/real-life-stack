import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@real-life-stack/toolkit': path.resolve(__dirname, '../../packages/toolkit/src'),
      '@real-life-stack/data-interface': path.resolve(__dirname, '../../packages/data-interface/src'),
      '@real-life-stack/mock-connector': path.resolve(__dirname, '../../packages/mock-connector/src'),
    },
  },
})
