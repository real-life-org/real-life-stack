import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"
import { buildInfo, buildInfoPlugin } from "../../scripts/build-info.mjs"

const toolkitSrc = path.resolve(__dirname, "../../packages/toolkit/src")

export default defineConfig({
  plugins: [react(), tailwindcss(), buildInfoPlugin(buildInfo(new URL("./package.json", import.meta.url)))],
  resolve: {
    alias: {
      "@real-life-stack/toolkit": toolkitSrc,
      "@": toolkitSrc,
    },
  },
})
