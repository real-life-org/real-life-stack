import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Im Repo hängen die Pakete am Quelltext (`development`-Condition). Dieses
// Beispiel nimmt bewusst die gebaute, veröffentlichte Form — so, wie eine App
// außerhalb des Repos sie von npm bekommt. Im Repo baut `pnpm dev:first-app`
// die Pakete vorher (turbo, `first-app^...`).
// Außerhalb des Repos entfallen `resolve.conditions` und `test.alias`.
const dist = (file: string) => fileURLToPath(new URL(`./node_modules/@real-life-stack/toolkit/dist/${file}`, import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { conditions: ["module", "browser", "production"] },
  test: {
    environment: "jsdom",
    alias: [
      { find: /^@real-life-stack\/toolkit$/, replacement: dist("index.js") },
      { find: /^@real-life-stack\/toolkit\/(maplibre|router)$/, replacement: dist("$1.js") },
    ],
  },
})
