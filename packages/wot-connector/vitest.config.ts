import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // Die Bildschirm-Tests laden das Toolkit über seine `development`-Bedingung
    // aus dem Quelltext; der benutzt intern den Alias `@` (wie in apps/reference).
    // Der Connector selbst kennt `@` nicht.
    alias: {
      "@": resolve(import.meta.dirname, "../toolkit/src"),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
  },
})
