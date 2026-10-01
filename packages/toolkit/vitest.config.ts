import { defineConfig } from "vitest/config"
import { resolve } from "path"

// Standalone vitest config — deliberately NOT extending vite.config.ts:
// the lib build there pulls in vite-plugin-dts and tailwind, which tests
// don't need and which slow down / break the test transform.
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    // Typtests (`*.test-d.ts`): laufen mit `vitest run` durch den Compiler —
    // etwa der Vertrag „Widgets bekommen keinen rohen Setter" (Formularzustand).
    typecheck: {
      enabled: true,
      include: ["tests/**/*.test-d.ts"],
      tsconfig: "./tsconfig.typetest.json",
    },
  },
})
