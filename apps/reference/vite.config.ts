import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import path from 'path'

const toolkitSrc = path.resolve(__dirname, '../../packages/toolkit/src')
const basePath = process.env.VITE_BASE_PATH || '/'

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm()],
  base: basePath,
  build: {
    // Required for Automerge WASM which uses top-level await
    target: 'esnext',
  },
  define: {
    'import.meta.env.VITE_BASE_PATH': JSON.stringify(basePath),
  },
  resolve: {
    alias: {
      '@real-life-stack/toolkit': toolkitSrc,
      '@': toolkitSrc,
    },
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer (Automerge WASM)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
