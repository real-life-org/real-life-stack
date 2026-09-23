import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// Die Pakete kommen von npm, genau wie bei einer App ausserhalb des Repos.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    // mock-connector 0.2.0 auf npm importiert in dist ohne .js-Endung; Node-ESM
    // findet das nicht, Vite schon. Bis zum naechsten Release laesst Vitest die
    // Pakete darum durch Vite laufen (rls#458). Danach kann die Zeile weg.
    server: { deps: { inline: [/@real-life-stack\//] } },
  },
})
